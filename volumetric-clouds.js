// Volumetric Clouds - Core Cloud Rendering Classes
// This module contains only cloud-related rendering logic, shaders, and classes.
// Three.js setup, OrbitControls, and application lifecycle should be handled separately.
// 
// Exports: CloudMaterial, CloudsRenderer, and supporting texture/material classes

import * as THREE from 'three';

// ========== SHADER CODE ==========
const shaderCommon = `
    #define UI0 1597334673U
    #define UI1 3812015801U
    #define UI2 uvec2(UI0, UI1)
    #define UI3 uvec3(UI0, UI1, 2798796415U)
    #define UIF (1.0 / float(0xffffffffU))

    vec3 hash33(vec3 p) {
        uvec3 q = uvec3(ivec3(p)) * UI3;
        q = (q.x ^ q.y ^ q.z)*UI3;
        return -1. + 2. * vec3(q) * UIF;
    }

    float remap(float x, float a, float b, float c, float d) {
        return (((x - a) / (b - a)) * (d - c)) + c;
    }
`;

const shaderPerlin = `
    float perlinNoise(vec3 x, float freq) {
        vec3 p = floor(x);
        vec3 w = fract(x);
        vec3 u = w * w * w * (w * (w * 6. - 15.) + 10.);
        
        vec3 ga = hash33(mod(p + vec3(0., 0., 0.), freq));
        vec3 gb = hash33(mod(p + vec3(1., 0., 0.), freq));
        vec3 gc = hash33(mod(p + vec3(0., 1., 0.), freq));
        vec3 gd = hash33(mod(p + vec3(1., 1., 0.), freq));
        vec3 ge = hash33(mod(p + vec3(0., 0., 1.), freq));
        vec3 gf = hash33(mod(p + vec3(1., 0., 1.), freq));
        vec3 gg = hash33(mod(p + vec3(0., 1., 1.), freq));
        vec3 gh = hash33(mod(p + vec3(1., 1., 1.), freq));
        
        float va = dot(ga, w - vec3(0., 0., 0.));
        float vb = dot(gb, w - vec3(1., 0., 0.));
        float vc = dot(gc, w - vec3(0., 1., 0.));
        float vd = dot(gd, w - vec3(1., 1., 0.));
        float ve = dot(ge, w - vec3(0., 0., 1.));
        float vf = dot(gf, w - vec3(1., 0., 1.));
        float vg = dot(gg, w - vec3(0., 1., 1.));
        float vh = dot(gh, w - vec3(1., 1., 1.));
        
        return va + 
               u.x * (vb - va) + 
               u.y * (vc - va) + 
               u.z * (ve - va) + 
               u.x * u.y * (va - vb - vc + vd) + 
               u.y * u.z * (va - vc - ve + vg) + 
               u.z * u.x * (va - vb - ve + vf) + 
               u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);
    }

    float perlinFbm(vec3 p, float freq, int octaves) {
        float G = exp2(-.85);
        float amp = 1.;
        float noise = 0.;
        for (int i = 0; i < octaves; ++i) {
            noise += amp * perlinNoise(p * freq, freq);
            freq *= 2.;
            amp *= G;
        }
        float result = noise;
        result = mix(1.0, result, 0.5);
        return abs(result * 2. - 1.);
    } 

    float perlinFbm(vec3 p, float freq) {
        return perlinFbm(p, freq, 2);
    }

    float curlNoise(vec3 p, float freq) {
        p *= freq;
        float curlFactor = 2.0;
        vec3 q = vec3(perlinNoise(p, freq), perlinNoise(p + vec3(5.2, 1.3, 7.1), freq), perlinNoise(p + vec3(1.7, 9.2, 3.1), freq));
        vec3 r = vec3(perlinNoise(p + q, freq), perlinNoise(p + q + vec3(5.2, 1.3, 7.1), freq), perlinNoise(p + q + vec3(1.7, 9.2, 3.1), freq));
        q = q * curlFactor;
        r = r * curlFactor;
        return remap(perlinNoise(p + r, freq), -1.0, 1.0, 0.0, 1.0);
    }
`;

const shaderWorley = `
    float worleyNoise(vec3 uv, float freq) {    
        vec3 id = floor(uv);
        vec3 p = fract(uv);
        float minDist = 10000.;
        for (float x = -1.; x <= 1.; ++x) {
            for(float y = -1.; y <= 1.; ++y) {
                for(float z = -1.; z <= 1.; ++z) {
                    vec3 offset = vec3(x, y, z);
                    vec3 h = hash33(mod(id + offset, vec3(freq))) * .5 + .5;
                    h += offset;
                    vec3 d = p - h;
                    minDist = min(minDist, dot(d, d));
                }
            }
        }
        return 1. - minDist;
    }

    float worleyFbm(vec3 p, float freq) {
        return worleyNoise(p*freq, freq) * .625 +
               worleyNoise(p*freq*2., freq*2.) * .25 +
               worleyNoise(p*freq*4., freq*4.) * .125;
    } 
`;

const shaderDefines = `
    #define PI 3.14159265359
    #define N_VOL_STEPS 32
    #define STEP_SIZE 0.02
    #define MAX_STEPS 128
    #define MAX_DIST 100.0
    #define SURF_DIST 0.001
    #define N_LIGHT_STEPS 4
    #define LIGHT_STEP_SIZE 0.02
    #define NB_STEPS 100

    const float densityScale = 1.0;
    const float transmittance = 1.0;
    const float darknessThreshold = 0.025;
    const float lightAbsorption = 1.0;
    const float anisotropicFactor = 0.4;
    const float phaseMix = 0.4;
    // Light direction in view/camera space (fixed relative to camera)
    // This is passed as a uniform and calculated from the original light position
    // to match the initial appearance
    const vec3 lightColor = vec3(1.0);
    const vec3 ambientLightColor = vec3(1.0) * 0.4;
`;

const shaderRay = `
    struct Ray {
        vec3 origin;
        vec3 dir;
    };
`;

const shaderIntersectAABB = `
    vec2 intersectAABB(Ray ray, vec3 boxMin, vec3 boxMax) {
        vec3 rayOrigin = ray.origin;
        vec3 rayDir = ray.dir;
        vec3 tMin = (boxMin - rayOrigin) / rayDir;
        vec3 tMax = (boxMax - rayOrigin) / rayDir;
        vec3 t1 = min(tMin, tMax);
        vec3 t2 = max(tMin, tMax);
        float tNear = max(max(t1.x, t1.y), t1.z);
        float tFar = min(min(t2.x, t2.y), t2.z);
        return vec2(tNear, tFar);
    }
`;

const shaderGetWorldSpacePos = `
    vec3 computeWorldPosition(vec2 uv, sampler2D tDepth, mat4 uProjectionInverse, mat4 uMatrixWorld) {
        float normalizedDepth = texture2D(tDepth, uv).r; 
        vec4 ndc = vec4(
            (uv.x - 0.5) * 2.0,
            (uv.y - 0.5) * 2.0,
            (normalizedDepth - 0.5) * 2.0,
            1.0);
        vec4 clip = uProjectionInverse * ndc;
        vec4 view = uMatrixWorld * (clip / clip.w);
        return view.xyz;
    }
`;

const shaderRayMarch = `
    float beersLaw(float density, float absorptionCoefficient) {
        return exp(-absorptionCoefficient * density);
    }

    float henyeyGreenstein(float g, float cosTheta) {
        float g2 = g * g;
        return 1.0 / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
    }

    float dualLobeHenyeyGreenstein(float g, float cosTheta, float K) {
        return mix(
            henyeyGreenstein(g, cosTheta),
            henyeyGreenstein(-g, cosTheta),
            K
        );
    }

    float multipleScattering(float depth, float g, float cosTheta, float K) {
        int octaves = 4;
        float attenuation = 0.5;
        float contribution = 0.5;
        float phaseAttenuation = 0.1;
        float luminance = 0.0;
        float a = 1.0;
        float b = 1.0;
        float c = 1.0;
        for (int i = 0; i < octaves; i++) {
            float beer = beersLaw(depth, a);
            float phase = dualLobeHenyeyGreenstein(g * c, cosTheta, K);
            luminance += b * phase * beer;
            a *= attenuation;
            b *= contribution;
            c *= (1.0 - phaseAttenuation);
        }
        return luminance;
    }

    vec3 marchDirectionalLight(vec3 samplePos, vec3 lightDirection, float cosTheta) {
        float lightDepth = 0.0;
        float lightDensity = 0.0;
        for (int j = 0; j < N_LIGHT_STEPS; j++) {
            lightDepth += LIGHT_STEP_SIZE;
            vec3 lightSamplePos = samplePos - lightDirection * lightDepth;
            float _lightDensity = getCloudDensity(lightSamplePos);
            _lightDensity = clamp(_lightDensity, 0.0, 1.0);
            lightDensity += _lightDensity * uDensityScale;
            if(lightDensity >= 1.0) break;
        }
        float luminance = multipleScattering(lightDensity, anisotropicFactor, cosTheta, phaseMix);
        return vec3(luminance);
    }

    vec4 rayMarch(vec3 ro, vec3 rd, float near, float far, vec3 aabbMin, vec3 aabbMax) {
        vec3 finalColor = vec3(0.0);
        float transmittance = 1.0;
        float depth = 0.0;
        float density = 0.0;
        // Transform view-space light direction to world space using camera rotation
        // This keeps the light direction fixed relative to the camera view
        vec3 lightDirection = normalize(uCameraRotationMatrix * uLightDirectionViewSpace);
        float cosTheta = dot(rd, lightDirection);
        float stepSize = (far - near) / float(MAX_STEPS);
        int steps = MAX_STEPS;
        vec3 samplePoint = ro + rd * near;
        samplePoint = (samplePoint - aabbMin) / (aabbMax - aabbMin);
        bool hasHit = false;
        float adaptiveStepSize = stepSize;
        
        for (int i = 0; i < steps; i++) {
            samplePoint += rd * adaptiveStepSize;
            if(samplePoint.x < 0.0 || samplePoint.x > 1.0 || samplePoint.y < 0.0 || samplePoint.y > 1.0 || samplePoint.z < 0.0 || samplePoint.z > 1.0) {
                break;
            }
            float _density;
            if(hasHit) {
                _density = getCloudDensity(samplePoint);
            } else {
                _density = getCloudDensity(samplePoint);
            }
            _density = clamp(_density, 0.0, 1.0);
            density += _density * uDensityScale;
            if(_density > 0.0) {
                if(!hasHit) {
                    hasHit = true;
                    depth -= adaptiveStepSize;
                    samplePoint -= rd * adaptiveStepSize;
                    adaptiveStepSize *= 0.5;
                    steps = int(1.0 / adaptiveStepSize);
                    continue;
                }
                vec3 luminance = marchDirectionalLight(samplePoint, lightDirection, cosTheta);
                finalColor += lightColor * uLightBrightness * luminance * density * transmittance;
                transmittance *= beersLaw(density, lightAbsorption);
                vec3 ambientLight = ambientLightColor;
                finalColor += ambientLight * density * transmittance;
            } else {
                if(hasHit) {
                    hasHit = false;
                    adaptiveStepSize = stepSize;
                    steps = MAX_STEPS;
                }
            }
            if(density >= 1.0) break;
            depth += adaptiveStepSize;
        }
        return vec4(finalColor, 1.0 - transmittance);
    }
`;

// ========== FULL SCREEN QUAD ==========
class FullScreenQuad {
    constructor(material) {
        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2, 1, 1),
            material
        );
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    dispose() {
        this.mesh.geometry.dispose();
    }

    render(renderer) {
        renderer.render(this.mesh, this.camera);
    }

    get material() {
        return this.mesh.material;
    }

    set material(value) {
        this.mesh.material = value;
    }
}

// ========== TEXTURE CLASSES ==========
class TextureA3D extends THREE.WebGL3DRenderTarget {
    constructor(width, height, depth) {
        super(width, height, depth, {
            depthBuffer: false,
            stencilBuffer: false,
        });
        this.texture.type = THREE.UnsignedByteType;
        this.texture.format = THREE.RGBAFormat;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;
    }
}

class TextureB3D extends THREE.WebGL3DRenderTarget {
    constructor(width, height, depth) {
        super(width, height, depth, {
            depthBuffer: false,
            stencilBuffer: false,
        });
        this.texture.type = THREE.UnsignedByteType;
        this.texture.format = THREE.RGBAFormat;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;
    }
}

class TextureC2D extends THREE.WebGLRenderTarget {
    constructor(width, height) {
        super(width, height, {
            depthBuffer: false,
            stencilBuffer: false,
        });
        this.texture.type = THREE.UnsignedByteType;
        this.texture.format = THREE.RGBAFormat;
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.generateMipmaps = false;
    }
}

class TextureEnvelope extends THREE.WebGLRenderTarget {
    constructor(width, height) {
        super(width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });
    }
}

class TextureScene extends THREE.WebGLRenderTarget {
    constructor(width, height) {
        const depthTexture = new THREE.DepthTexture(width, height);
        depthTexture.type = THREE.FloatType;
        depthTexture.minFilter = THREE.NearestFilter;
        depthTexture.magFilter = THREE.NearestFilter;
        depthTexture.generateMipmaps = false;

        super(width, height, {
            stencilBuffer: false,
            depthBuffer: true,
            depthTexture: depthTexture,
        });

        this.texture.type = THREE.UnsignedByteType;
        this.texture.format = THREE.RGBAFormat;
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.generateMipmaps = false;
    }
}

class TextureCloud extends THREE.WebGLRenderTarget {
    constructor(width, height) {
        super(width, height, {
            stencilBuffer: false,
            depthBuffer: false,
        });
    }
}

// ========== MATERIAL CLASSES ==========
class TextureA3DMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uZCoord;
                uniform float uSeed;
                varying vec2 vUv;
                ${shaderCommon}
                ${shaderPerlin}
                ${shaderWorley}
                void main() {
                    float scale = 1.0;
                    vec3 pos = vec3(vUv, uZCoord);
                    pos += hash33(vec3(uSeed)) * 100.0;
                    pos *= scale;
                    float baseFreq = 4.0 * scale;
                    float worleyFbmA = worleyFbm(pos, baseFreq);
                    float worleyFbmB = worleyFbm(pos, baseFreq * 2.0);
                    float worleyFbmC = worleyFbm(pos, baseFreq * 4.0);
                    float perlinFbm = perlinFbm(pos, baseFreq, 7);
                    float worleyPerlin = remap(perlinFbm, 0.0, 1.0, worleyFbmA, 1.0);
                    gl_FragColor = vec4(worleyPerlin, worleyFbmA, worleyFbmB, worleyFbmC);
                }
            `,
            uniforms: {
                uZCoord: { value: 0 },
                uSeed: { value: 1 },
            },
        });
    }

    set zCoord(value) {
        this.uniforms.uZCoord.value = value;
    }
}

class TextureB3DMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uZCoord;
                uniform float uSeed;
                varying vec2 vUv;
                ${shaderCommon}
                ${shaderWorley}
                void main() {
                    vec3 pos = vec3(vUv, uZCoord);
                    pos += hash33(vec3(uSeed)) * 100.0;
                    float baseFreq = 2.0;
                    float worleyFbmA = worleyFbm(pos, baseFreq);
                    float worleyFbmB = worleyFbm(pos, baseFreq * 2.0);
                    float worleyFbmC = worleyFbm(pos, baseFreq * 4.0);
                    gl_FragColor = vec4(worleyFbmA, worleyFbmB, worleyFbmC, 1.0);
                }
            `,
            uniforms: {
                uZCoord: { value: 0 },
                uSeed: { value: 1 },
            },
        });
    }

    set zCoord(value) {
        this.uniforms.uZCoord.value = value;
    }
}

class TextureC2DMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uSeed;
                varying vec2 vUv;
                ${shaderCommon}
                ${shaderPerlin}
                void main() {
                    vec3 pos = vec3(vUv, 0.0);
                    pos += hash33(vec3(uSeed)) * 100.0;
                    float baseFreq = 4.0;
                    float curlA = curlNoise(pos, baseFreq);
                    float curlB = curlNoise(pos, baseFreq * 2.0);
                    float curlC = curlNoise(pos, baseFreq * 4.0);
                    gl_FragColor = vec4(curlA, curlB, curlC, 1.0);
                }
            `,
            uniforms: {
                uSeed: { value: 1 },
            },
        });
    }
}

class TextureEnvelopeMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uSeed;
                varying vec2 vUv;
                ${shaderCommon}
                ${shaderPerlin}
                float hash(float n) {
                    return fract(sin(n) * 43758.5453);
                }
                float saturate(float value) {
                    return clamp(value, 0.0, 1.0);
                }
                void main() {
                    vec2 uv = vUv;
                    float minHeight = 0.25;
                    float scaleA = 2.0;
                    float seedA = hash(2.0);
                    float perlinA = perlinNoise(vec3((uv + (seedA * 1000.0)) * scaleA, 0.0), scaleA);
                    perlinA = remap(perlinA, -1.0, 1.0, 0.0, 1.0);
                    float maxHeight = perlinA;
                    float stratus = uv.y;
                    stratus = saturate(1.0 - abs(stratus - 0.95) * 2.0);
                    stratus = smoothstep(0.9, 1.0, stratus);
                    float cumulus = uv.y;
                    cumulus = saturate(1.0 - abs(cumulus - 0.7) * 2.0);
                    cumulus = smoothstep(0.3, 0.7, cumulus);
                    float cumulonimbus = uv.y;
                    cumulonimbus = saturate(1.0 - abs(cumulonimbus - 0.55) * 2.0);
                    cumulonimbus = smoothstep(0.0, 0.3, cumulonimbus);
                    float type = mix(stratus, cumulus, smoothstep(0.0, 0.5, uv.x));
                    type = mix(type, cumulonimbus, smoothstep(0.5, 1.0, uv.x));
                    gl_FragColor = vec4(minHeight, maxHeight, type, 0.0);
                }
            `,
            uniforms: {
                uSeed: { value: 1 },
            },
        });
    }
}

class RenderMaterial extends THREE.ShaderMaterial {
    constructor(renderer) {
        super({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D uSceneTexture;
                uniform sampler2D uSceneDepthTexture;
                uniform sampler2D uCloudTexture;
                uniform vec3 uBackgroundColor;
                uniform float uColorToneStrength;
                uniform float uSceneBrightness;
                
                vec3 rgb2hsv(vec3 c) {
                    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
                    float d = q.x - min(q.w, q.y);
                    float e = 1.0e-10;
                    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
                }
                
                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }
                
                void main() {
                    vec2 uv = vUv;
                    vec4 sceneColor = texture2D(uSceneTexture, uv);
                    vec4 cloudColor = texture2D(uCloudTexture, uv);
                    if(sceneColor.a <= 0.0) {
                        discard;
                        return;
                    } else {
                        // Apply color tone filter to blend clouds with background
                        vec3 bgColor = uBackgroundColor;
                        vec3 cloudRGB = cloudColor.rgb;
                        
                        // Convert to HSV for better color blending
                        vec3 cloudHSV = rgb2hsv(cloudRGB);
                        vec3 bgHSV = rgb2hsv(bgColor);
                        
                        // Blend hue and saturation towards background, preserve value
                        vec3 blendedHSV = vec3(
                            mix(cloudHSV.x, bgHSV.x, uColorToneStrength * 0.3),
                            mix(cloudHSV.y, bgHSV.y, uColorToneStrength * 0.2),
                            cloudHSV.z
                        );
                        
                        vec3 blendedRGB = hsv2rgb(blendedHSV);
                        
                        // Add subtle color tint
                        vec3 finalColor = mix(cloudRGB, blendedRGB, uColorToneStrength);
                        
                        // Apply scene brightness
                        finalColor *= uSceneBrightness;
                        
                        gl_FragColor = vec4(finalColor, cloudColor.a);
                    }
                }
            `,
            uniforms: {
                uSceneTexture: { value: renderer.textureScene.texture },
                uSceneDepthTexture: { value: renderer.textureScene.depthTexture },
                uCloudTexture: { value: renderer.textureCloud.texture },
                uBackgroundColor: { value: new THREE.Vector3(0, 0, 0) },
                uColorToneStrength: { value: 0.4 },
                uSceneBrightness: { value: 1.0 },
            },
            transparent: true,
        });
    }
}

class CloudMaterial extends THREE.ShaderMaterial {
    constructor(renderer) {
        super({
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vCameraPosition;
                varying vec3 vPosition;
                void main() {
                    vUv = uv;
                    vPosition = position;
                    vCameraPosition = cameraPosition;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp sampler3D;
                ${shaderDefines}
                ${shaderRay}
                ${shaderIntersectAABB}
                ${shaderGetWorldSpacePos}
                ${shaderCommon}
                ${shaderPerlin}
                ${shaderWorley}
                
                varying vec2 vUv;
                varying vec3 vCameraPosition;
                varying vec3 vPosition;
                
                uniform sampler2D uSceneTexture;
                uniform sampler2D uSceneDepthTexture;
                uniform sampler3D uTextureA;
                uniform sampler3D uTextureB;
                uniform sampler2D uTextureC;
                uniform sampler2D uTextureEnvelope;
                uniform vec2 uCameraNearFar;
                uniform vec3 uCameraPosition;
                uniform mat4 uProjectionInverse;
                uniform mat4 uCameraMatrixWorld;
                uniform mat4 uMatrixWorldInv;
                uniform mat3 uCameraRotationMatrix;
                uniform vec3 uBoxMin;
                uniform vec3 uBoxMax;
                uniform float uTime;
                uniform float uDensityScale;
                uniform float uCloudSpeed;
                uniform float uLightBrightness;
                uniform float uCloudScale;
                uniform vec3 uLightDirectionViewSpace;

                float saturate(float value) {
                    return clamp(value, 0.0, 1.0);
                }

                float remap2(float value, float valueMin, float valueMax) {
                    return (value - valueMin) / (valueMax - valueMin);
                }

                float getDimensionalProfile(vec3 p, out float heightBlend) {
                    vec4 textureEnvelope = texture(uTextureEnvelope, p.xz);
                    float minHeight = textureEnvelope.r;
                    float maxHeight = textureEnvelope.g;
                    float cloudType = textureEnvelope.b;
                    float density = textureEnvelope.a;
                    float clampedHeight = p.y * step(minHeight, p.y) * step(p.y, maxHeight);
                    float height = remap(clampedHeight, minHeight, maxHeight, 0.0, 1.0);
                    height = abs(height - 0.5) * 2.0;
                    height = 1.0 - height;
                    float edgeGradient = length(p.xz - 0.5) * 2.0;
                    edgeGradient = saturate(edgeGradient);
                    edgeGradient = 1.0 - edgeGradient;
                    edgeGradient = pow(edgeGradient, 1.0);
                    float dimensionalProfile = height * edgeGradient;
                    heightBlend = height;
                    return dimensionalProfile;
                }

                float getCloudDensity(vec3 p) {
                    float scale = uCloudScale;
                    vec3 coord = p * scale;
                    coord.x += uTime * uCloudSpeed;
                    coord = mod(coord, 1.0);
                    vec4 textureA = texture(uTextureA, coord);
                    float perlinWorley = textureA.r;
                    float worleyFbm4 = textureA.g;
                    float worleyFbm8 = textureA.b;
                    float worleyFbm16 = textureA.a;
                    float heightBlend = 0.0;
                    float dimensionalProfile = getDimensionalProfile(p, heightBlend);
                    float cloudDensity = saturate(perlinWorley - (1.0 - dimensionalProfile));
                    return cloudDensity;
                }

                ${shaderRayMarch}

                void main() {
                    vec2 uv = vUv;
                    vec4 sceneColor = texture2D(uSceneTexture, uv);
                    if(sceneColor.a == 0.0) {
                        discard;
                        return;
                    }
                    vec3 worldSpacePos = computeWorldPosition(vUv, uSceneDepthTexture, uProjectionInverse, uCameraMatrixWorld);
                    Ray ray;
                    ray.origin = uCameraPosition;
                    ray.dir = normalize(worldSpacePos - uCameraPosition);
                    vec3 aabbMin = uBoxMin;
                    vec3 aabbMax = uBoxMax;
                    vec2 nearFar = intersectAABB(ray, aabbMin, aabbMax);
                    vec4 color = rayMarch(ray.origin, ray.dir, nearFar.x, nearFar.y, aabbMin, aabbMax);
                    gl_FragColor = color;
                }
            `,
            uniforms: {
                uSceneTexture: { value: renderer.textureScene.texture },
                uSceneDepthTexture: { value: renderer.textureScene.depthTexture },
                uTextureA: { value: renderer.textureA3D.texture },
                uTextureB: { value: renderer.textureB3D.texture },
                uTextureC: { value: renderer.textureC2D.texture },
                uTextureEnvelope: { value: renderer.textureEnvelope.texture },
                uMatrixWorldInv: { value: new THREE.Matrix4() },
                uCameraNearFar: { value: new THREE.Vector2() },
                uCameraPosition: { value: new THREE.Vector3() },
                uProjectionInverse: { value: new THREE.Matrix4() },
                uCameraMatrixWorld: { value: new THREE.Matrix4() },
                uCameraRotationMatrix: { value: new THREE.Matrix3() },
                uBoxMin: { value: new THREE.Vector3() },
                uBoxMax: { value: new THREE.Vector3() },
                uTime: { value: 0 },
                uDensityScale: { value: 1.0 },
                uCloudSpeed: { value: 0.1 },
                uLightBrightness: { value: 2.0 },
                uCloudScale: { value: 2.0 },
                uLightDirectionViewSpace: { value: new THREE.Vector3(0.3, 0.8, 0.5) }, // Will be calculated on init
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
        });
    }
}

// Add update method to CloudMaterial
CloudMaterial.prototype.update = function(dt, target, camera) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uMatrixWorldInv.value.copy(target.matrixWorld).invert();
    const c = camera;
    this.uniforms.uCameraNearFar.value.set(c.near, c.far);
    this.uniforms.uCameraPosition.value.copy(c.position);
    this.uniforms.uProjectionInverse.value.copy(c.projectionMatrixInverse);
    this.uniforms.uCameraMatrixWorld.value.copy(c.matrixWorld);
    
    // Extract rotation matrix from camera's world matrix for camera-relative lighting
    // This keeps the light direction fixed relative to the camera view
    const rotationMatrix = new THREE.Matrix3();
    rotationMatrix.setFromMatrix4(c.matrixWorld);
    this.uniforms.uCameraRotationMatrix.value.copy(rotationMatrix);
    if (!this._box) {
        this._box = new THREE.Box3().setFromObject(target);
    }
    this.uniforms.uBoxMin.value.copy(this._box.min);
    this.uniforms.uBoxMax.value.copy(this._box.max);
};

// ========== CLOUDS RENDERER ==========
class CloudsRenderer {
    constructor(gl, size) {
        this._gl = gl;
        const downSampleFactor = 0.5;

        this.textureA3D = new TextureA3D(128, 128, 128);
        this.textureB3D = new TextureB3D(32, 32, 32);
        this.textureC2D = new TextureC2D(128, 128);
        this.textureEnvelope = new TextureEnvelope(256, 256);
        this.textureScene = new TextureScene(
            size.width * downSampleFactor,
            size.height * downSampleFactor
        );
        this.textureCloud = new TextureCloud(
            size.width * downSampleFactor,
            size.height * downSampleFactor
        );

        this.fsQuad = new FullScreenQuad();

        this.textureA3DMaterial = new TextureA3DMaterial();
        this.textureB3DMaterial = new TextureB3DMaterial();
        this.textureC2DMaterial = new TextureC2DMaterial();
        this.textureEnvelopeMaterial = new TextureEnvelopeMaterial();
        this.renderMaterial = new RenderMaterial(this);
        this.cloudMaterial = new CloudMaterial(this);

        this.generate3DTextures(this.textureA3DMaterial, this.textureA3D);
        this.generate3DTextures(this.textureB3DMaterial, this.textureB3D);
        this.generate2DTextures(this.textureC2DMaterial, this.textureC2D);
        this.generate2DTextures(this.textureEnvelopeMaterial, this.textureEnvelope);
    }

    generate2DTextures(material, fbo) {
        this.fsQuad.material = material;
        this._gl.setRenderTarget(fbo);
        this.fsQuad.render(this._gl);
        this._gl.setRenderTarget(null);
    }

    generate3DTextures(material, fbo) {
        const d = fbo.depth;
        this.fsQuad.material = material;
        for (let i = 0; i < d; i++) {
            const normalizedDepth = i / d;
            material.zCoord = normalizedDepth;
            this._gl.setRenderTarget(fbo, i);
            this.fsQuad.render(this._gl);
        }
        this._gl.setRenderTarget(null);
    }

    resize(size) {
        // Resize logic if needed
    }

    render(dt, target, camera, scene) {
        this._gl.setRenderTarget(this.textureScene);
        this._gl.render(target, camera);
        this._gl.setRenderTarget(null);

        const prevVisible = target.visible;
        target.visible = false;

        this._gl.render(scene, camera);

        const prevAutoClear = this._gl.autoClear;
        this._gl.autoClear = false;

        this.cloudMaterial.update(dt, target, camera);
        this.fsQuad.material = this.cloudMaterial;
        this._gl.setRenderTarget(this.textureCloud);
        this._gl.clear();
        this.fsQuad.render(this._gl);
        this._gl.setRenderTarget(null);

        this.fsQuad.material = this.renderMaterial;
        this.fsQuad.render(this._gl);

        this._gl.autoClear = prevAutoClear;
        target.visible = prevVisible;
    }
}

// ========== EXPORTS ==========
// Export only cloud-related classes for use in applications
export {
    FullScreenQuad,
    TextureA3D,
    TextureB3D,
    TextureC2D,
    TextureEnvelope,
    TextureScene,
    TextureCloud,
    TextureA3DMaterial,
    TextureB3DMaterial,
    TextureC2DMaterial,
    TextureEnvelopeMaterial,
    RenderMaterial,
    CloudMaterial,
    CloudsRenderer
};
