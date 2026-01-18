// Camera Views Manager - Store and tween between camera positions
// Uses localStorage to persist views across sessions

import * as THREE from 'three';

export class CameraViewsManager {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.views = this.loadViews();
        this.isTweening = false;
        this.tweenStartTime = 0;
        this.tweenDuration = 1500; // milliseconds
        this.startState = null;
        this.targetState = null;
    }

    // Load views from localStorage
    loadViews() {
        const stored = localStorage.getItem('cameraViews');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Failed to parse stored camera views', e);
            }
        }
        // Default views from user's provided data
        return {
            'View 1': {
                position: { x: -0.2583398972899281, y: -0.3757145744802861, z: -0.013557787292151981 },
                quaternion: { x: 0.1853621896414441, y: -0.6615151990654702, z: 0.17378712359795723, w: 0.7055753225051518 },
                target: { x: 0.13820014585079685, y: -0.15145280728823093, z: -0.03914463743838551 }
            },
            'View 2': {
                position: { x: 0.29644024421152537, y: 0.05054884999546381, z: -0.12094438181234098 },
                quaternion: { x: -0.04362606899015119, y: 0.8274529476139365, z: 0.06491825437933522, w: 0.5560611529659435 },
                target: { x: 0, y: 0, z: 0.000009999999999999999 }
            },
            'View 3': {
                position: { x: -0.03180964726741249, y: 0.029774755965192634, z: 0.3939814860785033 },
                quaternion: { x: -0.17811791016255382, y: 0.061352731834087765, z: 0.011127972480228402, w: 0.982031578211362 },
                target: { x: -0.07662627984931115, y: -0.10528696265901177, z: 0.03670672779247945 }
            },
            'View 4': {
                position: { x: -0.4332902987771194, y: -0.015951785767867918, z: -0.05385486177027746 },
                quaternion: { x: -0.0018128142103897085, y: 0.979329253978215, z: 0.008785620727929594, w: 0.2020735976705922 },
                target: { x: -0.5414091600701133, y: -0.02085303613524293, z: 0.1969841447991764 }
            },
            'View 5': {
                position: { x: -0.3136544196113673, y: -0.08628745949918896, z: 0.15169360735482862 },
                quaternion: { x: -0.02611540773727781, y: 0.7561900725235932, z: 0.030236211099466337, w: 0.65313117459958 },
                target: { x: -0.5830773755950858, y: -0.10809972217144279, z: 0.1913094327951627 }
            },
            'View 6': {
                position: { x: -0.0006615155812341947, y: -0.022606196680737104, z: -0.1619891751579923 },
                quaternion: { x: -0.00014142699060298893, y: 0.9975959518519513, z: -0.06926866722503516, w: -0.0020368082563187225 },
                target: { x: 0, y: 0, z: 0.000009999999999999999 }
            },
            'View 7': {
                position: { x: 0.13882468058045555, y: 0.00028151451461350986, z: -0.08872144061690203 },
                quaternion: { x: 0.015836122391788356, y: 0.8508019494137615, z: -0.025682236857906462, w: 0.524619560073116 },
                target: { x: -0.00706051832600734, y: 0.010147557603813903, z: -0.015404454748099016 }
            },
            'View 8': {
                position: { x: -0.1223093297454125, y: -0.07494592473955632, z: -0.4827993828960953 },
                quaternion: { x: -0.01713184859078374, y: 0.9810226438901867, z: -0.10278607162243887, w: -0.16351175926824715 },
                target: { x: 0.022466534302398443, y: 0.019628937730806515, z: -0.06055824620228135 }
            },
            'View 9': {
                position: { x: 0.3741978377925569, y: -0.07924470760672209, z: -0.3390266026975787 },
                quaternion: { x: 0.07127242495902765, y: 0.8901920981957694, z: -0.1494895625550073, w: 0.4244185910600361 },
                target: { x: 0.039142201684351646, y: 0.069798244329942, z: -0.06751978486661912 }
            },
            'View 10': {
                position: { x: 0.280970527224661, y: 0.03377082332548801, z: -0.032874798203154434 },
                quaternion: { x: 0.09528087575293366, y: 0.891111746048783, z: -0.38496288582702626, w: 0.22055608652986944 },
                target: { x: 0.254579468031304, y: 0.09387272892281515, z: 0.017173058201033202 }
            },
            'View 11': {
                position: { x: 0.2557860754785401, y: 0.011356822385732254, z: 0.018957507489506045 },
                quaternion: { x: 0.6672107724427468, y: 0.20981112513517552, z: -0.20440542047840612, w: 0.6848558249623864 },
                target: { x: 0.254579468031304, y: 0.09387272892281515, z: 0.017173058201033202 }
            },
            'View 12': {
                position: { x: 0.22486554423741364, y: 0.014258354832387132, z: 0.053681038095333075 },
                quaternion: { x: 0.426060092198445, y: -0.09671380658395674, z: 0.045868913726365784, w: 0.8983402919859805 },
                target: { x: 0.23598240684212843, y: 0.0781776535873057, z: 0.002649149976839553 }
            },
            'View 13': {
                position: { x: -0.1930102642334804, y: -0.23056804400907405, z: 0.06059286353804762 },
                quaternion: { x: 0.09264894478620528, y: 0.8536886763519475, z: 0.1627627938963057, w: -0.4859424758359071 },
                target: { x: -0.008913174899065136, y: -0.3152893018682769, z: 0.16990439433457802 }
            },
            'View 14': {
                position: { x: -0.6451394801733377, y: 0.11186561348488709, z: 0.41206482355368546 },
                quaternion: { x: -0.24462468336901738, y: -0.21567355945557276, z: -0.05590824297540262, w: 0.9436725853842396 },
                target: { x: -0.5414091600701133, y: -0.02085303613524293, z: 0.1969841447991764 }
            },
            'View 15': {
                position: { x: -0.23468458633538417, y: 0.21448724035139163, z: 0.5814618925880795 },
                quaternion: { x: -0.29013218835125837, y: -0.39798333348677484, z: -0.13428295190236386, w: 0.8598841017123481 },
                target: { x: 0.09366119716283158, y: -0.1134933395838417, z: 0.3027341473290539 }
            },
            'View 16': {
                position: { x: 0.4055148173253428, y: -0.06346762969375108, z: 0.3592027555532587 },
                quaternion: { x: -0.06900242870286953, y: 0.4516888895702074, z: 0.03506663140121411, w: 0.8888116466575524 },
                target: { x: 0.14682672210309272, y: -0.11349385270636089, z: 0.17041765681652823 }
            },
            'View 17': {
                position: { x: 0.3305935649037054, y: -0.07795622561776827, z: 0.30452681067165677 },
                quaternion: { x: -0.06900242870286954, y: 0.45168888957020764, z: 0.03506663140121413, w: 0.8888116466575522 },
                target: { x: 0.14682672210309272, y: -0.11349385270636089, z: 0.17041765681652823 }
            },
            'View 18': {
                position: { x: 0.3305935649037054, y: -0.07795622561776827, z: 0.30452681067165677 },
                quaternion: { x: -0.06900242870286954, y: 0.45168888957020764, z: 0.03506663140121413, w: 0.8888116466575522 },
                target: { x: 0.14682672210309272, y: -0.11349385270636089, z: 0.17041765681652823 }
            },
            'View 19': {
                position: { x: -0.12931938488966785, y: -0.21214564775469869, z: 0.25428379333230805 },
                quaternion: { x: 0.10198481012956528, y: -0.3335232429736864, z: 0.03632046157430606, w: 0.9365052957512741 },
                target: { x: 0.012814852382637082, y: -0.16258366214279443, z: 0.08004284298780112 }
            },
            'View 20': {
                position: { x: -0.27615647222756784, y: -0.18794787339100638, z: 0.1982656222229989 },
                quaternion: { x: -0.07446391501724706, y: -0.3829357317676711, z: -0.03098611840612516, w: 0.9202473641157489 },
                target: { x: -0.17962763560825398, y: -0.21011383110951634, z: 0.10236348568546584 }
            }
        };
    }

    // Save views to localStorage
    saveViews() {
        try {
            localStorage.setItem('cameraViews', JSON.stringify(this.views));
        } catch (e) {
            console.warn('Failed to save camera views', e);
        }
    }

    // Get current camera state
    getCurrentState() {
        return {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            target: this.controls.target.clone()
        };
    }

    // Save current view with a name
    saveView(name) {
        this.views[name] = {
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            quaternion: {
                x: this.camera.quaternion.x,
                y: this.camera.quaternion.y,
                z: this.camera.quaternion.z,
                w: this.camera.quaternion.w
            },
            target: {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            }
        };
        this.saveViews();
    }

    // Delete a view
    deleteView(name) {
        delete this.views[name];
        this.saveViews();
    }

    // Get list of view names
    getViewNames() {
        return Object.keys(this.views);
    }

    // Smooth tween between two states
    tweenToView(viewName) {
        if (!this.views[viewName]) {
            console.warn(`View "${viewName}" not found`);
            return;
        }

        if (this.isTweening) {
            // If already tweening, start from current position
            this.startState = this.getCurrentState();
        } else {
            this.startState = this.getCurrentState();
        }

        const targetView = this.views[viewName];
        this.targetState = {
            position: new THREE.Vector3(targetView.position.x, targetView.position.y, targetView.position.z),
            quaternion: new THREE.Quaternion(targetView.quaternion.x, targetView.quaternion.y, targetView.quaternion.z, targetView.quaternion.w),
            target: new THREE.Vector3(targetView.target.x, targetView.target.y, targetView.target.z)
        };

        this.isTweening = true;
        this.tweenStartTime = performance.now();
    }

    // Update tween (call this in animation loop)
    update() {
        if (!this.isTweening) return;

        const elapsed = performance.now() - this.tweenStartTime;
        const progress = Math.min(elapsed / this.tweenDuration, 1);

        // Easing function (ease-in-out)
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Interpolate position from start to target
        this.camera.position.copy(this.startState.position);
        this.camera.position.lerp(this.targetState.position, eased);

        // Interpolate quaternion (rotation) from start to target
        this.camera.quaternion.copy(this.startState.quaternion);
        this.camera.quaternion.slerp(this.targetState.quaternion, eased);

        // Interpolate target from start to target
        this.controls.target.copy(this.startState.target);
        this.controls.target.lerp(this.targetState.target, eased);

        // Update controls
        this.controls.update();

        // Check if tween is complete
        if (progress >= 1) {
            this.isTweening = false;
            // Ensure we're exactly at the target
            this.camera.position.copy(this.targetState.position);
            this.camera.quaternion.copy(this.targetState.quaternion);
            this.controls.target.copy(this.targetState.target);
            this.controls.update();
        }
    }
}
