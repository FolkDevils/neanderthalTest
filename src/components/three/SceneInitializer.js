"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function SceneInitializer() {
  const mountRef = useRef(null);

  useEffect(() => {
    class BasicCharacterControllerProxy {
      constructor(animations) {
        this._animations = animations;
      }

      get animations() {
        return this._animations;
      }
    }



    class BasicCharacterControllerInput {
      constructor() {
        this._Init();
      }

      _Init() {
        this._keys = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          space: false,
          shift: false,
        };

        document.addEventListener("keydown", (e) => this._onKeyDown(e), false);
        document.addEventListener("keyup", (e) => this._onKeyUp(e), false);
      }

      _onKeyDown(event) {
        console.log("Key down:", event.keyCode); // Debug log
        switch (event.keyCode) {
          case 87: // W
          case 38: // Up arrow
            this._keys.forward = true;
            break;
          case 83: // S
          case 40: // Down arrow
            this._keys.backward = true;
            break;
          case 65: // A
          case 37: // Left arrow
            this._keys.left = true;
            break;
          case 68: // D (Dance key)
            this._keys.dance = true; // Activate dance key
            this._keys.right = false; // Disable rightward movement during dance
            break;
            case 39: // Right arrow
            this._keys.right = true; // Add right arrow key trigger
            break;
          case 32: // Space
            this._keys.space = true;
            break;
          case 16: // Shift
            this._keys.shift = true;
            break;
        }
      }
      
      
      _onKeyUp(event) {
        console.log("Key up:", event.keyCode); // Debug log
        switch (event.keyCode) {
          case 87: // W
          case 38: // Up arrow
            this._keys.forward = false;
            break;
          case 83: // S
          case 40: // Down arrow
            this._keys.backward = false;
            break;
          case 65: // A
          case 37: // Left arrow
            this._keys.left = false;
            break;
          case 68: // D (Dance key)
            this._keys.dance = false; // Stop dancing
            break; // Do not re-enable `right` here to prevent immediate spinning
          case 39: // Right arrow
            this._keys.right = false;
            break;
          case 32: // Space
            this._keys.space = false;
            break;
          case 16: // Shift
            this._keys.shift = false;
            break;
        }
      }
      
      
      
    }

    class BasicCharacterController {
      constructor(params) {
        this._Init(params);
      }
    
      _Init(params) {
        this._params = params;
        this._input = new BasicCharacterControllerInput();
        this._deceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
        this._acceleration = new THREE.Vector3(1, 0.25, 100.0);
        this._velocity = new THREE.Vector3(0, 0, 0);
    
        this._animations = {};
        this._stateMachine = new CharacterFSM(
          new BasicCharacterControllerProxy(this._animations)
        );
    
        this._LoadModels();
      }
    
      _LoadModels() {
        const loadingManager = new THREE.LoadingManager();
    
        loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
          console.log(`Started loading: ${url}. Loaded ${itemsLoaded} of ${itemsTotal} items.`);
        };
    
        loadingManager.onLoad = () => {
          console.log("All FBX files loaded successfully.");
          this._stateMachine.SetState("idle"); // Start with idle state after all files load
        };
    
        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
          console.log(`Loading in progress: ${url}. ${itemsLoaded} of ${itemsTotal} items loaded.`);
        };
    
        loadingManager.onError = (url) => {
          console.error(`Error loading file: ${url}`);
        };
    
        const loader = new FBXLoader(loadingManager);
        loader.setPath("/resources/zombie/");
        loader.load("mremireh_o_desbiens.fbx", (fbx) => {
          console.log("Main character model loaded.");
          fbx.scale.setScalar(0.1);
          fbx.traverse((c) => {
            if (c.isMesh) c.castShadow = true;
          });
    
          this._target = fbx;
          this._params.scene.add(this._target);
    
          this._mixer = new THREE.AnimationMixer(this._target);
    
          const _OnLoad = (animName, anim) => {
            const clip = anim.animations[0];
            const action = this._mixer.clipAction(clip);
            this._animations[animName] = { clip, action };
          };
    
          const animLoader = new FBXLoader(loadingManager);
          animLoader.setPath("/resources/zombie/");
          animLoader.load("walk.fbx", (a) => _OnLoad("walk", a));
          animLoader.load("run.fbx", (a) => _OnLoad("run", a));
          animLoader.load("idle.fbx", (a) => _OnLoad("idle", a));
          animLoader.load("dancing.fbx", (a) => _OnLoad("dance", a));

        });
      }
    
      Update(timeInSeconds) {
        if (!this._target) return;
      
        this._stateMachine.Update(timeInSeconds, this._input);
      
        const velocity = this._velocity;
        const frameDeceleration = new THREE.Vector3(
          velocity.x * this._deceleration.x,
          velocity.y * this._deceleration.y,
          velocity.z * this._deceleration.z
        );
        frameDeceleration.multiplyScalar(timeInSeconds);
        velocity.add(frameDeceleration);
      
        const controlObject = this._target;
        const _Q = new THREE.Quaternion();
        const _A = new THREE.Vector3();
        const _R = controlObject.quaternion.clone();
      
        const acc = this._acceleration.clone();
        if (this._input._keys.shift) {
          acc.multiplyScalar(3.0); // Increase speed for running
        }
      
        if (this._input._keys.forward) {
          velocity.z += acc.z * timeInSeconds * .5; // Faster forward movement
        }
        if (this._input._keys.backward) {
          velocity.z -= acc.z * timeInSeconds * .5; // Faster backward movement
        }
        if (!this._input._keys.dance) {
          // Only process rotation when not dancing
          if (this._input._keys.left) {
            _A.set(0, 1, 0); // Rotate around the Y-axis (upward)
            _Q.setFromAxisAngle(
              _A,
              2.0 * Math.PI * timeInSeconds * this._acceleration.y
            ); // Rotate left (counter-clockwise)
            _R.multiply(_Q);
          }
          if (this._input._keys.right) {
            _A.set(0, 1, 0); // Rotate around the Y-axis (upward)
            _Q.setFromAxisAngle(
              _A,
              -2.0 * Math.PI * timeInSeconds * this._acceleration.y
            ); // Rotate right (clockwise)
            _R.multiply(_Q);
          }
        }
        controlObject.quaternion.copy(_R);
        
      
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(controlObject.quaternion);
        forward.normalize();
      
        const sideways = new THREE.Vector3(1, 0, 0);
        sideways.applyQuaternion(controlObject.quaternion);
        sideways.normalize();
      
        forward.multiplyScalar(velocity.z * timeInSeconds);
        sideways.multiplyScalar(velocity.x * timeInSeconds);
      
        controlObject.position.add(forward);
        controlObject.position.add(sideways);
      
        if (this._mixer) {
          this._mixer.update(timeInSeconds);
        }
      }
    }
    
    class CharacterFSM {
      constructor(proxy) {
        this._proxy = proxy;
        this._states = {};
        this._currentState = null;

        this._AddState("idle", IdleState);
        this._AddState("walk", WalkState);
        this._AddState("run", RunState);
        this._AddState("dance", DanceState); 

        

      }

      _AddState(name, type) {
        this._states[name] = type;
      }

      SetState(name) {
        console.log("Transitioning to state:", name);
        const prevState = this._currentState;
      
        if (prevState && prevState.Name === name) return;
      
        const state = new this._states[name](this);
        this._currentState = state;
        state.Enter(prevState);
      }
      

      Update(timeElapsed, input) {
        if (this._currentState) this._currentState.Update(timeElapsed, input);
      }
    }

    class State {
      constructor(parent) {
        this._parent = parent;
      }

      Enter() {}
      Exit() {}
      Update(_) {}
    }

    class DanceState extends State {
      get Name() {
        return "dance";
      }
    
      Enter(prevState) {
        const danceAction = this._parent._proxy.animations["dance"].action;
        if (prevState) {
          const prevAction = this._parent._proxy.animations[prevState.Name].action;
          danceAction.reset().fadeIn(0.5).play();
          prevAction.fadeOut(0.5);
        } else {
          danceAction.play();
        }
      }
    
      Update(_, input) {
        // Transition to idle if the dance key is released
        if (!input._keys.dance) {
          this._parent.SetState("idle");
        }
      }
    
      Exit() {
        // Ensure clean exit from dance to idle
        const danceAction = this._parent._proxy.animations["dance"].action;
        danceAction.fadeOut(0.5);
      }
    }
    

  class IdleState extends State {
  get Name() {
    return "idle";
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy.animations["idle"].action;
    if (prevState) {
      const prevAction = this._parent._proxy.animations[prevState.Name].action;
      idleAction.reset().fadeIn(0.5).play();
      prevAction.fadeOut(0.5);
    } else {
      idleAction.play();
    }
  }

  Update(_, input) {
    if (input._keys.dance) {
      this._parent.SetState("dance");
    } else if (input._keys.forward || input._keys.backward) {
      this._parent.SetState("walk");
    }
  }
}


class WalkState extends State {
  get Name() {
    return "walk";
  }

  Enter(prevState) {
    const walkAction = this._parent._proxy.animations["walk"].action;
    if (prevState) {
      const prevAction = this._parent._proxy.animations[prevState.Name].action;
      walkAction.reset().fadeIn(0.5).play();
      prevAction.fadeOut(0.5);
    } else {
      walkAction.play();
    }
  }

  Update(_, input) {
    if (input._keys.dance) {
      this._parent.SetState("dance");
    } else if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState("run"); // Transition to run state
        return;
      }
    } else {
      this._parent.SetState("idle");
    }
  }
}


    class RunState extends State {
      get Name() {
        return "run";
      }

      Enter(prevState) {
        const runAction = this._parent._proxy.animations["run"].action;
        if (prevState) {
          const prevAction = this._parent._proxy.animations[prevState.Name].action;
          runAction.time = 0.0;
          runAction.enabled = true;
          runAction.setEffectiveTimeScale(1.0);
          runAction.setEffectiveWeight(1.0);
          runAction.crossFadeFrom(prevAction, 0.5, true);
          runAction.play();
        } else {
          runAction.play();
        }
      }

      Update(_, input) {
        if (input._keys.forward || input._keys.backward) {
          if (!input._keys.shift) {
            this._parent.SetState("walk");
          }
          return;
        }

        this._parent.SetState("idle");
      }
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: Use soft shadows
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 10, 30);
  // Roll

    controls.target.set(0, 10, 0);   // Keeps the focus on the scene center
    controls.update();

    const light = new THREE.DirectionalLight(0xffffff, 4.0);
    light.position.set(0, 5, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    scene.add(light);


    const loader = new THREE.CubeTextureLoader();
const texture = loader.load([
  '/resources/cube/test.png',
  '/resources/cube/test.png',
  '/resources/cube/posy.jpg',
  '/resources/cube/negy.jpg',
  '/resources/cube/test.png',
  '/resources/cube/test.png',
]);
texture.encoding = THREE.sRGBEncoding;
scene.background = texture; // Set as scene background


    // Create ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1); // White light with intensity 0.5

// Add it to the scene
scene.add(ambientLight);


const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.ShadowMaterial({ opacity: 0.05 }) // ShadowMaterial makes the plane invisible but catches shadows
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true; // Allow the plane to receive shadows
scene.add(plane);


    const characterController = new BasicCharacterController({ scene });

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = 0.01;
      characterController.Update(delta);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-screen"></div>;
}
