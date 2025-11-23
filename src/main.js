import './style.css'

import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap/gsap-core';

const pageSize = 7000;

let introDone = false;
let screenTouched = false;
let scrollPercent = 0;

let projectLights = [];
let videosPlayers = [];

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

// Setup and play animations.gltf
const loader = new GLTFLoader();
const animLoaded = await loader.loadAsync( '/animations.glb' );
const loadingMesh = animLoaded.scene
const mixer = new THREE.AnimationMixer( loadingMesh );
scene.add( loadingMesh );
const mask = loadingMesh.getObjectByName("Mask");
const Windows = loadingMesh.getObjectByName("Windows");
const display1 = loadingMesh.getObjectByName("Display1");
const display1hover = loadingMesh.getObjectByName("Display1Hover");
Windows.visible = false;
Windows.frustumCulled = false;
const loading_anim = play_clip(animLoaded, mixer, "loading", false);

const textureLoader = new THREE.TextureLoader();

// Enter Text Label
const enterTextP = document.createElement("p");
enterTextP.textContent = "click to enter my portfolio";
enterTextP.id = "enter-text";
const enterTextLabel = new CSS3DObject(enterTextP);
scene.add(enterTextLabel);
enterTextLabel.position.set(0, -3, 2);
enterTextLabel.scale.set(0.005, 0.005, 0.005);

// Name Label
// newText("Jonas Amrouche", "name-text", 0, 0, -147, 0.01)
// newText("Developper", "dev-title-text", 0, -2, -149, 0.01)
// newText("Interactive Experience", "dev-title-text", 0, 2, -149, 0.01)

function newText(text, id, x, y, z, size){
  const p = document.createElement("p");
  p.textContent = text;
  p.id = id;
  const Label = new CSS3DObject(p);
  scene.add(Label);
  Label.position.set(x, y, z);
  Label.scale.set(size, size, size);
  Label.visible = true;
  return Label
}

// Create glowy quad-ring
const geometry = new THREE.RingGeometry( 2, 3, 4 );
const rectangleColor = new THREE.Color( 'rgba(255, 255, 255, 1)' );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: rectangleColor, emissiveIntensity: 1});
const torus = new THREE.Mesh(geometry, material);
torus.position.set(0, 0, -2)
scene.add(torus);

// Create animated wireframe tunel
const pageGridGeometry = new THREE.CylinderGeometry( 5, 5, 60, 50, 100, true);
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
pageGrid.position.set(0, 0, -130.0)
pageGrid.rotation.set(Math.PI/2.0, 0, 0)
scene.add(pageGrid);

// Project Tabs
newProject("FireLive", "/firelive_screen1.jpg", 0, -180)

const display1Material = new THREE.MeshStandardMaterial( { map: textureLoader.load("/firelive_screen1_holo.jpg"), emissiveMap: textureLoader.load("/firelive_screen_emi.jpg"), emissiveIntensity:0.0, alphaMap: textureLoader.load("/hologram_alpha.jpg"), transparent:true } );
display1.material = display1Material;

function newProject(title, imgPath, x, z){
  // const titleP = document.createElement("p");
  // titleP.textContent = title;
  // titleP.id = "project-title";
  // titleP.setAttribute('class', "project-ui");
  // const TitleLabel = new CSS3DObject(titleP);
  // scene.add(TitleLabel);
  // TitleLabel.position.set(x-2, 4, z);
  // TitleLabel.scale.set(0.005, 0.005, 0.005);
  // const projectI = document.createElement("img");
  // projectI.src = imgPath;
  // projectI.id = "project-video";
  // projectI.setAttribute('class', "project-ui");
  // const projectImg = new CSS3DObject(projectI);
  // scene.add(projectImg);
  // projectImg.position.set(x, 0.2, z);
  // projectImg.scale.set(0.004, 0.004, 0.004);
  // projectImg.rotation.set(0, Math.PI/16.0, 0);
}

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
  loadingSound.setVolume( 2.0 );
  loadingSound.play();
});

// Setup intro sound
const introSound = new THREE.Audio( listener );
audioLoader.load( '/intro_sound.ogg', function( buffer ) {
  introSound.setBuffer( buffer );
  introSound.setLoop( false );
  introSound.setVolume( 1.0 );
});

// Pointless Point light
const pointLight = new THREE.PointLight(0xffffff, 100, 10);
pointLight.position.set(0, 0, 3);
scene.add(pointLight);

// Create clock for animations
const clock = new THREE.Clock();

projectLights.push(projectLight("/flashreel.mov", 0, 0, 0))

projectLights.push(projectLight("/firelive_screen1_blured.jpg", -20, 0, -20.3))

projectLights.push(projectLight("/eluminscreen1blured.jpg", 20, 0, 20.3))

// Project lights
function projectLight(texture_path, x_pos, z_pos, x_target) {
  let texture;
  if (texture_path.split('.')[texture_path.split('.').length-1] == "mov"){
    // Create video and play
    const textureVid = document.createElement("video")
    textureVid.src = texture_path; // transform gif to mp4
    textureVid.loop = true;
    videosPlayers.push(textureVid);

    // Load video texture
    const videoTexture = new THREE.VideoTexture(textureVid);
    videoTexture.format = THREE.RGBFormat;
    videoTexture.minFilter = THREE.NearestFilter;
    videoTexture.magFilter = THREE.NearestFilter;
    videoTexture.generateMipmaps = false;
    texture = videoTexture;
  }else{
    texture = textureLoader.load(texture_path);
  }
  const projectLight = new THREE.SpotLight(0xffffff, 0, 200, Math.PI/4, 1.0);
  scene.add(projectLight);
  projectLight.map = texture;
  projectLight.position.set(x_pos, z_pos, -170);
  projectLight.target.position.set(x_target, 0, -177);
  scene.add(projectLight.target);

  return projectLight
}

// const ambienceLight1 = new THREE.PointLight(0xff0000, 10, 10);
// scene.add(ambienceLight1);
// ambienceLight1.position.set(-21, -0.2, -172);
// const ambienceLight2 = new THREE.PointLight(0xffffff, 10, 7);
// scene.add(ambienceLight2);
// ambienceLight2.position.set(0, 2, -172);
// const ambienceLight3 = new THREE.PointLight(0x00ddbb, 10, 10);
// scene.add(ambienceLight3);
// ambienceLight3.position.set(21, -0.2, -172);

const raycaster = new THREE.Raycaster();

// Add post-processing
const composer = new EffectComposer( renderer );
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
const fxaaPass = new FXAAPass();
composer.addPass( fxaaPass );
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass( resolution, 0.5, 0.4, 0.7 );
// const bloomPass = new UnrealBloomPass( resolution, 0.2, 0.1, 0.5 );
composer.addPass( bloomPass );
// const bokehPass = new BokehPass( scene, camera, {focus: 9.35,aperture: 0.001,maxblur: 0.1});
// bokehPass.setSize(window.innerWidth, window.innerHeight)
// composer.addPass( bokehPass );
const outputPass = new OutputPass();
composer.addPass(outputPass);


addEventListener("mousemove", (event) => {
  const coords = new THREE.Vector2(event.clientX / renderer.domElement.clientWidth * 2 - 1, -(event.clientY / renderer.domElement.clientHeight * 2 - 1));
  raycaster.setFromCamera(coords, camera);
  const intersections = raycaster.intersectObjects(scene.children, true);
  if (intersections.length > 0){
    if (intersections[0].object.name == "Display1"){
      display1.material.emissiveIntensity = 1.0
      display1hover.visible = true
      document.body.style.cursor = "pointer"
    } else{
      display1.material.emissiveIntensity = 0.6
      display1hover.visible = false
      document.body.style.cursor = "default"

    }
  }
 })

// Dev only
let skipIntro = false;
if (skipIntro){
  camera.position.set(0, 0, -167);
  camera.fov = 50.0;
  camera.updateProjectionMatrix();
  torus.visible = false;
  mask.visible = false;
  display1.material.emissiveIntensity = 0.6
  Windows.visible = true;
  for(var i=0; i<projectLights.length; i++){
    projectLights[i].intensity = 50;
  }
  var elements = document.querySelectorAll('.project-ui');
  for(var i=0; i<elements.length; i++){
    elements[i].style.opacity = "100%";
  }
  pageGrid.material.uniforms.uOpacity = {value : 1.0}
  introDone = true;
  document.querySelector('body').style.height = pageSize.toString() + "px";
  window.scrollTo(0, pageSize/2 - window.innerHeight/2);
}


function animate() {
  requestAnimationFrame(animate);

  // Updates animations times
  mixer.update(clock.getDelta());
  pageGrid.material.uniforms.uTime = {value : clock.elapsedTime};

  updateScroll();

  triggerEnter();
  
  // Render scene
  flatRenderer.render(scene, camera);
  composer.render();
}

function updateScroll(){
  if (introDone){
    // FireliveScene.position.set(-scrollPercent*0.4, FireliveScene.position.y, FireliveScene.position.z);
    camera.position.set((scrollPercent-50)*0.4, camera.position.y, camera.position.z);
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

let introTriggered
function triggerEnter(){
  if (loading_anim.time < 0.1 && screenTouched && !introTriggered){
    screenTouched = false
    introTriggered = true
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
                let soundObj = { value: 0 };
                gsap.to(soundObj, {
                  value: 2.0,
                  duration: 4.0,
                  ease: "expo.in",
                  onUpdate: () => {
                    ambientSound.setVolume(soundObj.value);
                  }
                });

                let opacityObj = { value: 0 };
                gsap.to(opacityObj, {
                  value: 100.0,
                  delay:2.0,
                  duration: 2.0,
                  ease: "expo.in",
                  onUpdate: () => {
                    var elements = document.querySelectorAll('.project-ui');
                    for(var i=0; i<elements.length; i++){
                        elements[i].style.opacity = (opacityObj.value).toString() + "%";
                    }
                  }
                });

                let projectorsObj = { value: 0 };
                gsap.to(projectorsObj, {
                  value: 50.0,
                  delay:3,
                  duration: 5,
                  ease: "power2.inOut",
                  onUpdate: () => {
                    for(var i=0; i<projectLights.length; i++){
                        projectLights[i].intensity = projectorsObj.value;
                    }
                  }
                });
                    
                gsap.to(pageGrid.material.uniforms.uOpacity, {
                  delay: 2.5,
                  value: 1.0,
                  duration: 2.0,
                  ease: "power2.out",
                });
                gsap.to(camera, {
                  delay: 2.5,
                  fov: 50.0,
                  duration: 1.0,
                  ease: "power2.out",
                  onUpdate: () => {
                    camera.updateProjectionMatrix();
                  },
                });
                gsap.to(camera.position, {
                  x: 0,
                  y: 0,
                  z: -167,
                  duration: 5,
                  ease: "power2.inOut",
                });
                gsap.to(camera.rotation, {
                  x: 0,
                  y: 0,
                  z: Math.PI*2.0,
                  duration: 4,
                  ease: "power2.inOut",
                  onComplete: () => {
                    for(var i=0; i<videosPlayers.length; i++){
                      videosPlayers[i].play()
                    }
                    introDone = true;
                    display1.material.emissiveIntensity = 0.6
                    document.querySelector('body').style.height = pageSize.toString() + "px";
                    window.scrollTo(0, pageSize/2 - window.innerHeight/2);
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
  // for(var i=0; i<videosPlayers.length; i++){
  //   videosPlayers[i].play()
  // }

  if (skipIntro){ return; }

  screenTouched = true
  enterTextLabel.visible = false
  ambientSound.play();
});

document.body.onscroll = () => {
    scrollPercent = ((document.documentElement.scrollTop || document.body.scrollTop) / ((document.documentElement.scrollHeight || document.body.scrollHeight) - document.documentElement.clientHeight)) * 100;
}

animate()