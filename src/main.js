import './style.css'

import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap/gsap-core';
import { mix } from 'three/tsl';

let introDone = false;
let screenTouched = false;
let scrollPercent = 0;

// Create 3D renderer
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg') });

// Create 3D HTLM renderer
const flatRenderer = new CSS3DRenderer();
document.body.appendChild(flatRenderer.domElement);
flatRenderer.domElement.id = "flat-render"

// Create scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8)

updateSreenSize();

// Enter Text Label
const enterTextP = document.createElement("p");
enterTextP.textContent = "click to enter";
enterTextP.id = "enter-text";
const enterTextLabel = new CSS3DObject(enterTextP);
scene.add(enterTextLabel);
enterTextLabel.position.set(0, -3, 2);
enterTextLabel.scale.set(0.005, 0.005, 0.005);

// Name Label
const NameP = document.createElement("p");
NameP.setHTMLUnsafe("Jonas<br>Amrouche");
NameP.id = "name-text";
const NameLabel = new CSS3DObject(NameP);
scene.add(NameLabel);
NameLabel.position.set(0, 0, -150);
NameLabel.scale.set(0.01, 0.01, 0.01);
NameLabel.visible = false;

// Create glowy quad-ring
const geometry = new THREE.RingGeometry( 2, 3, 4 );
const rectangleColor = new THREE.Color( 'rgba(255, 255, 255, 1)' );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: rectangleColor, emissiveIntensity: 1});
const torus = new THREE.Mesh(geometry, material);
torus.position.set(0, 0, -2)
scene.add(torus);

// Create synthwave vibe plane grid
const pageGridGeometry = new THREE.CylinderGeometry( 5, 5, 50, 50, 200);
const pageGridVertexShader = document.getElementById('buttonVertexShader').textContent;
const pageGridFragmentShader = document.getElementById('buttonFragmentShader').textContent;
const pageGridMaterial = new THREE.ShaderMaterial( {
  vertexShader:pageGridVertexShader,
  fragmentShader:pageGridFragmentShader,
  wireframe:true,
  uniforms : {
    uTime:0.0,
    uOpacity:0.0
  }});
const pageGrid = new THREE.Mesh(pageGridGeometry, pageGridMaterial);
pageGrid.position.set(0, 0, -120.0)
pageGrid.rotation.set(Math.PI/2.0, 0, 0)
scene.add(pageGrid);

// Setup sounds
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add( listener );

// Setup base ambient sound
const ambientSound = new THREE.Audio( listener );
audioLoader.load( '/note_b_loop.ogg', function( buffer ) {
  ambientSound.setBuffer( buffer );
  ambientSound.setLoop( true );
  ambientSound.setVolume( 0.0 );
});

// Setup loading sound
const loadingSound = new THREE.Audio( listener );
audioLoader.load( '/loading_loop.ogg', function( buffer ) {
  loadingSound.setBuffer( buffer );
  loadingSound.setLoop( true );
  loadingSound.setVolume( 1.0 );
  loadingSound.play();
});

// Setup intro sound
const introSound = new THREE.Audio( listener );
audioLoader.load( '/intro_sound.ogg', function( buffer ) {
  introSound.setBuffer( buffer );
  introSound.setLoop( false );
  introSound.setVolume( 0.5 );
});

// Setup and play animations.gltf
const loader = new GLTFLoader();
const animLoaded = await loader.loadAsync( '/animations.glb' );
const loadingMesh = animLoaded.scene
const mixer = new THREE.AnimationMixer( loadingMesh );
scene.add( loadingMesh );
const mask = loadingMesh.getObjectByName("Mask");
const Windows = loadingMesh.getObjectByName("Windows");
Windows.visible = false;
Windows.frustumCulled = false;
const loading_anim = play_clip(animLoaded, mixer, "loading", false);

// Pointless Point light
const pointLight = new THREE.PointLight(0xffffff, 100)
pointLight.position.set(0, 0, 3)//3
scene.add(pointLight);

// Add post-processing
const composer = new EffectComposer( renderer );
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass( resolution, 1, 0.4, 0.7 );
composer.addPass( bloomPass );

// Dev only
let skipIntro = false;
if (skipIntro){
  camera.position.set(0, 0, -140);
  torus.visible = false;
  mask.visible = false;
  Windows.visible = true;
  pageGrid.material.uniforms.uOpacity = {value : 1.0}
  introDone = true;
  document.querySelector('body').style.height = "5000px";
  window.scrollTo(0, 0);
}

// Create clock for animations
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  // Updates animations times
  mixer.update(clock.getDelta());
  pageGrid.material.uniforms.uTime = {value : clock.elapsedTime};

  updateCameraScroll();

  triggerEnter();
  
  // Render scene
  flatRenderer.render(scene, camera);
  composer.render();
}

function updateCameraScroll(){
  if (introDone){
    camera.position.set(camera.position.x, camera.position.y, scrollPercent*0.4 - 140);
  }
}

function play_clip(gltfLoad, mixer, clipName, oneShot) {
  const clips = gltfLoad.animations;
  const clip = THREE.AnimationClip.findByName( clips, clipName );
  const animation = mixer.clipAction( clip );
  animation.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat)
  animation.play();
  return animation
}

function triggerEnter(){
  if (loading_anim.time < 0.1 && screenTouched){
    screenTouched = false
    enter()
  }
}

function enter(){
  if (skipIntro){ return; }

  introSound.play();
  loadingSound.stop();
    gsap.to(mixer, {
      timeScale: 5.575,
      duration: 6.0,
      ease: "power2.inOut",
      onComplete: () => {
        mixer.timeScale = 1.0;
        gsap.to(torus.scale, {
          x: 10,
          y: 10,
          z: 10,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            torus.visible = false;
            mask.visible = false;
            Windows.visible = true;
            pageGrid.material.uniforms.uOpacity = {value : 0.0}
            play_clip(animLoaded, mixer, "intro", true)
            gsap.to(camera, {
              fov: 100,
              duration: 0.5,
              ease: "power2.inOut",
              onUpdate: () => {
                camera.updateProjectionMatrix();
              },
              onComplete: () => {
                ambientSound.play();
                let obj = { value: 0 };
                gsap.to(obj, {
                  value: 1.0,
                  duration: 4.0,
                  ease: "power4.in",
                  onUpdate: () => {
                    ambientSound.setVolume(obj.value);
                  }
                });
                gsap.to(camera.position, {
                  x: 0,
                  y: 0,
                  z: -140,
                  duration: 5,
                  ease: "power2.inOut",
                });
                gsap.to(camera.rotation, {
                  x: 0,
                  y: 0,
                  z: Math.PI*2.0,
                  duration: 3,
                  ease: "power2.inOut",
                  onComplete: () => {
                    
                    NameLabel.visible = true;
                    gsap.to(pageGrid.material.uniforms.uOpacity, {
                      value: 1.0,
                      duration: 2.0,
                      ease: "power2.In",
                      onComplete: () => {
                        introDone = true;
                        document.querySelector('body').style.height = "5000px";
                        window.scrollTo(0, 0);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
}

window.addEventListener('resize', function(){
  updateSreenSize();
})

function updateSreenSize(){
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  flatRenderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("click", () => {
    const context = listener.context;

    if (context.state === "suspended") {
        context.resume().then(() => {
            console.log("AudioContext resumed");
            screenTouched = true
            enterTextLabel.visible = false
        });
    } else {
        ambientSound.play();
    }
});

document.body.onscroll = () => {
    scrollPercent = ((document.documentElement.scrollTop || document.body.scrollTop) / ((document.documentElement.scrollHeight || document.body.scrollHeight) - document.documentElement.clientHeight)) * 100;
}

animate()