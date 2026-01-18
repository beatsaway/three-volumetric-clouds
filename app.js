// Application Setup - Three.js initialization and controls
// This file handles Three.js scene setup, OrbitControls, and application lifecycle

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    CloudsRenderer
} from './volumetric-clouds.js';

// Initialize the volumetric clouds application
export function initVolumetricClouds(options = {}) {
    const {
        container = document.body,
        cameraPosition = [0.9, 0, -0.9],
        boxSize = 1,
        onControlsReady = null,
        onAnimateUpdate = null
    } = options;

    // Three.js scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(...cameraPosition);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // OrbitControls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.target.set(0, 0, 0.00001);
    controls.update();

    // Calculate initial view-space light direction from original world-space light position
    // Original code: lightDirection = -normalize(lightPosition - cameraPosition)
    // Original light position: vec3(-2.0, 0, 2.0)
    const originalLightPosition = new THREE.Vector3(-2.0, 0, 2.0);
    const originalLightDirectionWorld = originalLightPosition.clone()
        .sub(camera.position)
        .negate()
        .normalize();
    
    // Extract camera rotation matrix and transform world-space light direction to view space
    // This ensures the initial lighting matches the original appearance
    // For camera-relative lighting, we transform the world direction to view space
    const cameraRotationMatrix = new THREE.Matrix3();
    cameraRotationMatrix.setFromMatrix4(camera.matrixWorld);
    const cameraRotationInverse = cameraRotationMatrix.clone().transpose(); // Inverse of rotation = transpose
    const initialLightDirectionView = originalLightDirectionWorld.clone().applyMatrix3(cameraRotationInverse);

    // Create target mesh for cloud rendering
    const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    const targetMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    scene.add(targetMesh);

    // Initialize cloud renderer
    const cloudsRenderer = new CloudsRenderer(renderer, {
        width: window.innerWidth,
        height: window.innerHeight,
    });

    let clock = new THREE.Clock();
    const cloudMaterial = cloudsRenderer.cloudMaterial;
    
    // Set the initial view-space light direction to match original appearance
    cloudMaterial.uniforms.uLightDirectionViewSpace.value.copy(initialLightDirectionView);

    // Setup controls if callback provided
    if (onControlsReady) {
        onControlsReady(cloudMaterial, cloudsRenderer);
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        controls.update();
        cloudsRenderer.render(dt, targetMesh, camera, scene);
        
        // Update camera tweening if active
        if (onAnimateUpdate) {
            onAnimateUpdate(dt);
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        cloudsRenderer.resize({
            width: window.innerWidth,
            height: window.innerHeight,
        });
    });

    animate();

    // Helper function to convert hex color to RGB vector
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? new THREE.Vector3(
            parseInt(result[1], 16) / 255.0,
            parseInt(result[2], 16) / 255.0,
            parseInt(result[3], 16) / 255.0
        ) : new THREE.Vector3(0, 0, 0);
    }

    // Function to update background color
    function updateBackgroundColor(hexColor) {
        const rgb = hexToRgb(hexColor);
        scene.background = new THREE.Color(hexColor);
        cloudsRenderer.renderMaterial.uniforms.uBackgroundColor.value.copy(rgb);
    }

    // Set initial background color
    updateBackgroundColor('#011029');

    return {
        scene,
        camera,
        renderer,
        controls,
        cloudsRenderer,
        cloudMaterial,
        targetMesh,
        updateBackgroundColor
    };
}
