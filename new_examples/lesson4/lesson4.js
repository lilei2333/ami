/* globals Stats, dat, AMI*/

var LoadersVolume = AMI.default.Loaders.Volume;
var CamerasOrthographic = AMI.default.Cameras.Orthographic;
var ControlsOrthographic = AMI.default.Controls.TrackballOrtho;
var HelpersLut = AMI.default.Helpers.Lut;
var HelpersStack = AMI.default.Helpers.Stack;
let HelpersSegmentationLut = AMI.default.Helpers.SegmentationLut;
let PresetsSegmentation = AMI.default.Presets.Segmentation;

// Shaders
// Data
var ShadersDataUniforms = AMI.default.Shaders.DataUniform;
var ShadersDataFragment = AMI.default.Shaders.DataFragment;
var ShadersDataVertex = AMI.default.Shaders.DataVertex;
// Layer
var ShadersLayerUniforms = AMI.default.Shaders.LayerUniform;
var ShadersLayerFragment = AMI.default.Shaders.LayerFragment;
var ShadersLayerVertex = AMI.default.Shaders.LayerVertex;

// standard global variables
var controls;
var renderer;
var camera;
var statsyay;
var threeD;
//
var sceneLayer0TextureTarget;
var sceneLayer1TextureTarget;
//
var sceneLayer0;
//
var lutLayer0;
var sceneLayer1;
var meshLayer1;
var uniformsLayer1;
var materialLayer1;
var lutLayer1;
var sceneLayerMix;
var meshLayerMix;
var uniformsLayerMix;
var materialLayerMix;

var layerMix = {
  opacity1: 1.0,
};
/**
 * Init the scene
 */
function init() {
  document.getElementById("my-lut-canvases-l1").style = "display:none";

  /**
   * Animation loop
   */
  function animate() {
    // render
    controls.update();
    // render first layer offscreen
    renderer.render(sceneLayer0, camera, sceneLayer0TextureTarget, true);
    // render second layer offscreen
    renderer.render(sceneLayer1, camera, sceneLayer1TextureTarget, true);
    // mix the layers and render it ON screen!
    renderer.render(sceneLayerMix, camera);
    statsyay.update();

    // request new frame
    requestAnimationFrame(function () {
      animate();
    });
  }

  // renderer
  threeD = document.getElementById('container');
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(threeD.clientWidth, threeD.clientHeight);
  renderer.setClearColor(0x607D8B, 1);

  threeD.appendChild(renderer.domElement);

  // stats
  statsyay = new Stats();
  threeD.appendChild(statsyay.domElement);

  // scene
  sceneLayer0 = new THREE.Scene();
  sceneLayer1 = new THREE.Scene();
  sceneLayerMix = new THREE.Scene();

  // render to texture!!!!
  sceneLayer0TextureTarget = new THREE.WebGLRenderTarget(
    threeD.clientWidth,
    threeD.clientHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });

  sceneLayer1TextureTarget = new THREE.WebGLRenderTarget(
    threeD.clientWidth,
    threeD.clientHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });

  // camera
  camera = new CamerasOrthographic(
    threeD.clientWidth / -2, threeD.clientWidth / 2,
    threeD.clientHeight / 2, threeD.clientHeight / -2,
    0.1, 10000);

  // controls
  controls = new ControlsOrthographic(camera, threeD);
  controls.staticMoving = true;
  controls.noRotate = true;
  camera.controls = controls;

  animate();
}

/**
 * Build GUI
 */
function buildGUI(stackHelper) {
  /**
   * Update Layer 1
   */
  function updateLayer1() {
    // update layer1 geometry...
    if (meshLayer1) {
      // dispose geometry first
      meshLayer1.geometry.dispose();
      meshLayer1.geometry = stackHelper.slice.geometry;
      meshLayer1.geometry.verticesNeedUpdate = true;
    }
  }

  /**
   * Update layer mix
   */
  function updateLayerMix() {
    // update layer1 geometry...
    if (meshLayerMix) {
      sceneLayerMix.remove(meshLayerMix);
      meshLayerMix.material.dispose();
      meshLayerMix.material = null;
      meshLayerMix.geometry.dispose();
      meshLayerMix.geometry = null;

      // add mesh in this scene with right shaders...
      meshLayerMix = new THREE.Mesh(
        stackHelper.slice.geometry, materialLayerMix);
      // go the LPS space
      meshLayerMix.applyMatrix(stackHelper.stack._ijk2LPS);

      sceneLayerMix.add(meshLayerMix);
    }
  }

  var stack = stackHelper.stack;

  var gui = new dat.GUI({
    autoPlace: false,
  });

  var customContainer = document.getElementById('my-gui-container');
  customContainer.appendChild(gui.domElement);

  var layer0Folder = gui.addFolder('CT');
  layer0Folder.add(stackHelper.slice, 'invert');

  var lutUpdate = layer0Folder.add(
    stackHelper.slice, 'lut', lutLayer0.lutsAvailable());
  lutUpdate.onChange(function (value) {
    lutLayer0.lut = value;
    stackHelper.slice.lutTexture = lutLayer0.texture;
  });

  var indexUpdate = layer0Folder.add(
    stackHelper, 'index', 0, stack.dimensionsIJK.z - 1).step(1).listen();
  indexUpdate.onChange(function () {
    updateLayer1();
    updateLayerMix();
  });

  layer0Folder.add(
    stackHelper.slice, 'interpolation', 0, 1).step(1).listen();

  layer0Folder.open();

  // layer mix folder
  var layerMixFolder = gui.addFolder('Segmentation');
  var opacityLayerMix1 = layerMixFolder.add(
    layerMix, 'opacity1', 0, 1).step(0.01);
  opacityLayerMix1.onChange(function (value) {
    uniformsLayerMix.uOpacity1.value = value;
  });

  layerMixFolder.open();

  // hook up callbacks
  controls.addEventListener('OnScroll', function (e) {
    if (e.delta > 0) {
      if (stackHelper.index >= stack.dimensionsIJK.z - 1) {
        return false;
      }
      stackHelper.index += 1;
    } else {
      if (stackHelper.index <= 0) {
        return false;
      }
      stackHelper.index -= 1;
    }

    updateLayer1();
    updateLayerMix();
  });

  updateLayer1();
  updateLayerMix();

  /**
   * Handle window resize
   */
  function onWindowResize() {
    var threeD = document.getElementById('container');
    camera.canvas = {
      width: threeD.clientWidth,
      height: threeD.clientHeight,
    };
    camera.fitBox(2);

    renderer.setSize(threeD.clientWidth, threeD.clientHeight);
  }
  window.addEventListener('resize', onWindowResize, false);
  onWindowResize();
}


window.onload = function () {
  // init threeJS...
  init();

  /**
   * Handle series
   */
  function handleSeries() {
    //
    //
    // first stack of first series
    var mergedSeries = loader.data[0].mergeSeries(loader.data);
    var stack = mergedSeries[0].stack[0];
    var stack2 = mergedSeries[1].stack[0];
    loader.free();
    loader = null;

    if (mergedSeries[0].seriesInstanceUID === 'https://rawgit.com/YorkeUtopy/ami-viewerData/master/labels.nii.gz') {
      stack = mergedSeries[1].stack[0];
      stack2 = mergedSeries[0].stack[0];
    }

    var stackHelper = new HelpersStack(stack);
    stackHelper.bbox.visible = false;
    stackHelper.border.visible = false;
    stackHelper.index = 90;

    sceneLayer0.add(stackHelper);

    //
    //
    // create labelmap....
    // we only care about the geometry....
    // get first stack from series
    // prepare it
    // * ijk2LPS transforms
    // * Z spacing
    // * etc.
    //
    stack2.prepare();
    // pixels packing for the fragment shaders now happens there
    stack2.pack();

    var textures2 = [];
    for (var m = 0; m < stack2._rawData.length; m++) {
      var tex = new THREE.DataTexture(
        stack2.rawData[m],
        stack2.textureSize,
        stack2.textureSize,
        stack2.textureType,
        THREE.UnsignedByteType,
        THREE.UVMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.NearestFilter,
        THREE.NearestFilter);
      tex.needsUpdate = true;
      tex.flipY = true;
      textures2.push(tex);
    }

    // create material && mesh then add it to sceneLayer1
    uniformsLayer1 = ShadersDataUniforms.uniforms();
    uniformsLayer1.uTextureSize.value = stack2.textureSize;
    uniformsLayer1.uTextureContainer.value = textures2;
    uniformsLayer1.uWorldToData.value = stack2.lps2IJK;
    uniformsLayer1.uNumberOfChannels.value = stack2.numberOfChannels;
    uniformsLayer1.uPixelType.value = stack2.pixelType;
    uniformsLayer1.uBitsAllocated.value = stack2.bitsAllocated;
    uniformsLayer1.uWindowCenterWidth.value = [stack2.windowCenter, stack2.windowWidth];
    uniformsLayer1.uRescaleSlopeIntercept.value = [stack2.rescaleSlope, stack2.rescaleIntercept];
    uniformsLayer1.uDataDimensions.value = [stack2.dimensionsIJK.x,
      stack2.dimensionsIJK.y,
      stack2.dimensionsIJK.z
    ];
    uniformsLayer1.uInterpolation.value = 0;

    // generate shaders on-demand!
    var fs = new ShadersDataFragment(uniformsLayer1);
    var vs = new ShadersDataVertex();
    materialLayer1 = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: uniformsLayer1,
      vertexShader: vs.compute(),
      fragmentShader: fs.compute(),
    });

    // add mesh in this scene with right shaders...
    meshLayer1 = new THREE.Mesh(stackHelper.slice.geometry, materialLayer1);
    // go the LPS space
    meshLayer1.applyMatrix(stack._ijk2LPS);
    sceneLayer1.add(meshLayer1);

    // Create the Mix layer
    uniformsLayerMix = ShadersLayerUniforms.uniforms();
    uniformsLayerMix.uTextureBackTest0.value = sceneLayer0TextureTarget.texture;
    uniformsLayerMix.uTextureBackTest1.value = sceneLayer1TextureTarget.texture;

    let fls = new ShadersLayerFragment(uniformsLayerMix);
    let vls = new ShadersLayerVertex();
    materialLayerMix = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: uniformsLayerMix,
      vertexShader: vls.compute(),
      fragmentShader: fls.compute(),
      transparent: true,
    });

    // add mesh in this scene with right shaders...
    meshLayerMix = new THREE.Mesh(stackHelper.slice.geometry, materialLayer1);
    // go the LPS space
    meshLayerMix.applyMatrix(stack._ijk2LPS);
    sceneLayerMix.add(meshLayerMix);

    //
    // set camera
    var worldbb = stack.worldBoundingBox();
    var lpsDims = new THREE.Vector3(
      worldbb[1] - worldbb[0],
      worldbb[3] - worldbb[2],
      worldbb[5] - worldbb[4]
    );

    // box: {halfDimensions, center}
    var box = {
      center: stack.worldCenter().clone(),
      halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
    };

    // init and zoom
    var canvas = {
      width: threeD.clientWidth,
      height: threeD.clientHeight,
    };
    camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
    camera.box = box;
    camera.canvas = canvas;
    camera.update();
    camera.fitBox(2);

    // CREATE LUT
    lutLayer0 = new HelpersLut(
      'my-lut-canvases-l0',
      'default',
      'linear',
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1]
      ],
      [
        [0, 1],
        [1, 1]
      ]);
    lutLayer0.luts = HelpersLut.presetLuts();

    lutLayer1 = new HelpersSegmentationLut(
      "my-lut-canvases-l1",
      "Freesurfer",
    );
    var presetsSegmentation = new PresetsSegmentation('Freesurfer');
    lutLayer1.segmentation = presetsSegmentation.preset;

    //Update segmentation
    uniformsLayer1.uLutSegmentation.value = 1;
    uniformsLayer1.uTextureLUTSegmentation.value = lutLayer1.texture;
    buildGUI(stackHelper);
  }

  dataFullPath = ['https://rawgit.com/YorkeUtopy/ami-viewerData/master/T1stripvolume.nii.gz'];
  labelmapFullPath = ['https://rawgit.com/YorkeUtopy/ami-viewerData/master/labels.nii.gz'];

  var files = dataFullPath.concat(labelmapFullPath);

  // load sequence for each file
  // instantiate the loader
  // it loads and parses the dicom image
  var loader = new LoadersVolume(threeD);
  loader.load(files)
    .then(function () {
      handleSeries();
    })
    .catch(function (error) {
      window.console.log('oops... something went wrong...');
      window.console.log(error);
    });
};