// standard global variables
let stats;
let ready = false;
let labelChangeMap = new Map();
const sameSignLabels1 = new Set(['R', 'A', 'I']);
const sameSignLabels2 = new Set(['L', 'P', 'S']);
const pairMap = new Map([
  ['R', 'L'],
  ['L', 'R'],
  ['A', 'P'],
  ['P', 'A'],
  ['I', 'S'],
  ['S', 'I']
]);
let sameInitialDirectionMap = new Map();

let isEditing = false;
let isDrawing = false;
let cursor = {
  color: '#d9d9d9',
  value: 0,
  size: 15,
  shape: 'round',
  segment: 'erase',
};
let segmentsList = ['erase', '1'];
let segmentsDict = {
  erase: {
    color: '#d9d9d9',
    value: 0,
  },
  1: {
    color: 'rgba(70, 130, 180, 1)',
    value: 1,
  },
};
let stack2;

// 3d renderer
const r0 = {
  domId: 'r0',
  domElement: null,
  renderer: null,
  color: 0x212121,
  targetID: 0,
  camera: null,
  controls: null,
  scene: null,
  light: null,
};

// 2d axial renderer
const r1 = {
  domId: 'r1',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'axial',
  sliceColor: 0xff1744,
  targetID: 1,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  segCanvasId: 'canvasDiv1',
  segCanvasDiv: null,
  segCanvas: null,
  segContext: null,
  segScene0: null,
  segScene1: null,
  segSceneLayer0TextureTarget: null,
  segSceneLayer1TextureTarget: null,
  segTextures: null,
  segMeshLayer: null,
  segUniformsLayerMix: null,
  segMaterialLayerMix: null,
  segMeshLayerMix: null,
  segLastPoint: null,
  segijkBBox: [99999999, 0, 9999999, 0, 999999999, 0],
};

// 2d sagittal renderer
const r2 = {
  domId: 'r2',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'sagittal',
  sliceColor: 0xffea00,
  targetID: 2,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  segCanvasId: 'canvasDiv2',
  segCanvasDiv: null,
  segCanvas: null,
  segContext: null,
  segScene0: null,
  segScene1: null,
  segSceneLayer0TextureTarget: null,
  segSceneLayer1TextureTarget: null,
  segTextures: null,
  segMeshLayer: null,
  segUniformsLayerMix: null,
  segMaterialLayerMix: null,
  segMeshLayerMix: null,
  segLastPoint: null,
  segijkBBox: [99999999, 0, 9999999, 0, 999999999, 0],
};

// 2d coronal renderer
const r3 = {
  domId: 'r3',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'coronal',
  sliceColor: 0x76ff03,
  targetID: 3,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  segCanvasId: 'canvasDiv3',
  segCanvasDiv: null,
  segCanvas: null,
  segContext: null,
  segScene0: null,
  segScene1: null,
  segSceneLayer0TextureTarget: null,
  segSceneLayer1TextureTarget: null,
  segTextures: null,
  segMeshLayer: null,
  segUniformsLayerMix: null,
  segMaterialLayerMix: null,
  segMeshLayerMix: null,
  segLastPoint: null,
  segijkBBox: [99999999, 0, 9999999, 0, 999999999, 0],
};

function clearCanvas(context) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function setupEditor() {

  function distanceBetween(point1, point2) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  }

  function angleBetween(point1, point2) {
    return Math.atan2(point2.x - point1.x, point2.y - point1.y);
  }


  /**
   *  Loop through IJK BBox and see if voxel can be mapped to screen
   */
  function mapCanvasToData(refObj) {
    for (let i = refObj.segijkBBox[0]; i < refObj.segijkBBox[1] + 1; i++) {
      for (let j = refObj.segijkBBox[2]; j < refObj.segijkBBox[3] + 1; j++) {
        for (let k = refObj.segijkBBox[4]; k < refObj.segijkBBox[5] + 1; k++) {
          // ijk to world
          // center of voxel
          let worldCoordinate = new THREE.Vector3(i, j, k).applyMatrix4(stack2._ijk2LPS);
          // world to screen coordinate
          let screenCoordinates = worldCoordinate.clone();
          screenCoordinates.project(refObj.camera);

          screenCoordinates.x = Math.round(((screenCoordinates.x + 1) * refObj.segCanvas.offsetWidth) / 2);
          screenCoordinates.y = Math.round(((-screenCoordinates.y + 1) * refObj.segCanvas.offsetHeight) / 2);
          screenCoordinates.z = 0;

          let pixel = refObj.segContext.getImageData(screenCoordinates.x, screenCoordinates.y, 1, 1).data;
          if (pixel[3] > 0 && i >= 0 && j >= 0 && k >= 0) {
            // find index and texture
            let voxelIndex = i + j * stack2._columns + k * stack2._rows * stack2._columns;
            let textureSize = 4096;
            let textureDimension = textureSize * textureSize * 4;

            let rawDataIndex;
            let inRawDataIndex;
            let oldValue;
            let newValue;

            // see ami.js/model/model.stack.js 529 _packTo8Bits
            switch (stack2._bitsAllocated) {
              case 8:
                rawDataIndex = ~~(voxelIndex / textureDimension);
                inRawDataIndex = voxelIndex % textureDimension;
                // update value...
                oldValue = stack2.rawData[rawDataIndex][inRawDataIndex];
                newValue = cursor.value;
                if (oldValue != newValue) {
                  // update raw data
                  stack2._rawData[rawDataIndex][inRawDataIndex] = newValue;
                  // update texture that is passed to shader
                  [r1, r2, r3].forEach(function (e) {
                    e.segTextures[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                    e.segTextures[rawDataIndex].needsUpdate = true;
                  });
                }
                break;
              case 16:
                voxelIndex *= 2;
                rawDataIndex = ~~(voxelIndex / textureDimension);
                inRawDataIndex = voxelIndex % textureDimension;
                // update value...
                oldValue =
                  (stack2.rawData[rawDataIndex][inRawDataIndex + 1] << 8) |
                  (stack2.rawData[rawDataIndex][inRawDataIndex]);
                newValue = cursor.value;
                if (oldValue != newValue) {
                  // update raw data
                  stack2._rawData[rawDataIndex][inRawDataIndex] = (newValue) & 0x00ff;
                  stack2._rawData[rawDataIndex][inRawDataIndex + 1] = (newValue >>> 8) & 0x00ff;
                  // update texture that is passed to shader
                  [r1, r2, r3].forEach(function (e) {
                    e.segTextures[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                    e.segTextures[rawDataIndex].needsUpdate = true;
                  });
                  // AMI.UtilsCore.setPixelData(stack2, new THREE.Vector3(i, j, k), newValue);
                }
                break;
              case 32:
                voxelIndex *= 4;
                rawDataIndex = ~~(voxelIndex / textureDimension);
                inRawDataIndex = voxelIndex % textureDimension;
                // update value...
                oldValue =
                  (stack2.rawData[rawDataIndex][inRawDataIndex + 3] << 24) |
                  (stack2.rawData[rawDataIndex][inRawDataIndex + 2] << 16) |
                  (stack2.rawData[rawDataIndex][inRawDataIndex + 1] << 8) |
                  (stack2.rawData[rawDataIndex][inRawDataIndex]);
                newValue = cursor.value;
                if (oldValue != newValue) {
                  // update raw data
                  stack2._rawData[rawDataIndex][inRawDataIndex] = (newValue) & 0x000000FF;
                  stack2._rawData[rawDataIndex][inRawDataIndex + 1] = (newValue >>> 8) & 0x000000FF;
                  stack2._rawData[rawDataIndex][inRawDataIndex + 2] = (newValue >>> 16) & 0x000000FF;
                  stack2._rawData[rawDataIndex][inRawDataIndex + 3] = (newValue >>> 24) & 0x000000FF;
                  // update texture that is passed to shader
                  [r1, r2, r3].forEach(function (e) {
                    e.segTextures[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                    e.segTextures[rawDataIndex].needsUpdate = true;
                  });
                }
                break;
              default:
                break;
            }
          }
        }
      }
    }
  }

  function drawCircle(x, y, context) {
    context.beginPath();
    context.arc(x, y, cursor.size, false, Math.PI * 2, false);
    context.closePath();
    context.fill();
    context.stroke();
  }

  function addEventListeners() {

    function onMouseDown(e) {
      if (!isEditing) return;
      isDrawing = true;
      let id = e.target.parentElement.id;
      let temp = null;
      switch (id) {
        case 'canvasDiv1':
          temp = r1;
          break;
        case 'canvasDiv2':
          temp = r2;
          break;
        case 'canvasDiv3':
          temp = r3;
          break;
        default:
          return;
      }
      temp.segLastPoint = {
        x: e.pageX - temp.segCanvasDiv.parentElement.offsetLeft,
        y: e.pageY - temp.segCanvasDiv.parentElement.offsetTop,
      };
    }

    function onMouseMove(e) {
      if (!isEditing) return;
      let id = e.target.parentElement.id;
      let temp = null;
      switch (id) {
        case 'canvasDiv1':
          temp = r1;
          break;
        case 'canvasDiv2':
          temp = r2;
          break;
        case 'canvasDiv3':
          temp = r3;
          break;
        default:
          return;
      }
      let currentPoint = {
        x: e.pageX - temp.segCanvasDiv.parentElement.offsetLeft,
        y: e.pageY - temp.segCanvasDiv.parentElement.offsetTop,
      };

      temp.segContext.strokeStyle = cursor.color;
      temp.segContext.globalCompositeOperation = 'xor';
      temp.segContext.globalAlpha = 0.5;
      temp.segContext.fillStyle = cursor.color;

      if (isDrawing) {
        let dist = distanceBetween(temp.segLastPoint, currentPoint);
        let angle = angleBetween(temp.segLastPoint, currentPoint);

        for (let i = 0; i < dist; i += 5) {
          let x = temp.segLastPoint.x + Math.sin(angle) * i;
          let y = temp.segLastPoint.y + Math.cos(angle) * i;
          drawCircle(x, y, temp.segContext);
        }

        temp.segLastPoint = currentPoint;
      } else {
        clearCanvas(temp.segContext);
      }

      // draw under the cursor
      temp.segContext.globalCompositeOperation = 'source-over';
      temp.segContext.globalAlpha = 1;
      temp.segContext.fillStyle = 'rgba(0, 0, 0, 0)';
      drawCircle(currentPoint.x, currentPoint.y, temp.segContext);
    }

    function onMouseUp(e) {
      if (!isEditing) return;
      let id = e.target.parentElement.id;
      let temp = null;
      switch (id) {
        case 'canvasDiv1':
          temp = r1;
          break;
        case 'canvasDiv2':
          temp = r2;
          break;
        case 'canvasDiv3':
          temp = r3;
          break;
        default:
          return;
      }
      isDrawing = false;
      mapCanvasToData(temp);
      [r1, r2, r3].forEach(function (e) {
        clearCanvas(e.segContext);
      });
      // clearCanvas(temp.segContext);
      // draw cursor under mouse
      onMouseMove(e);
    }

    function disableRightClick(e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // add events listeners
    [r1, r2, r3].forEach(function (e) {
      e.segCanvasDiv.addEventListener('mousedown', onMouseDown, false);
      e.segCanvasDiv.addEventListener('mousemove', onMouseMove, false);
      e.segCanvasDiv.addEventListener('mouseup', onMouseUp, false);
      e.segCanvasDiv.addEventListener('contextmenu', disableRightClick, false);

    });
  }

  addEventListeners();
}

function initRenderer3D(renderObj) {
  $('#' + renderObj.domId).empty();
  // renderer
  renderObj.domElement = document.getElementById(renderObj.domId);
  renderObj.renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  renderObj.renderer.setSize(renderObj.domElement.clientWidth, renderObj.domElement.clientHeight);
  renderObj.renderer.setClearColor(renderObj.color, 1);
  renderObj.renderer.domElement.id = renderObj.targetID;
  renderObj.domElement.appendChild(renderObj.renderer.domElement);

  // camera
  renderObj.camera = new THREE.PerspectiveCamera(
    45,
    renderObj.domElement.clientWidth / renderObj.domElement.clientHeight,
    0.1,
    100000
  );
  renderObj.camera.position.x = 250;
  renderObj.camera.position.y = 250;
  renderObj.camera.position.z = 250;

  // controls
  renderObj.controls = new AMI.TrackballControl(renderObj.camera, renderObj.domElement);
  renderObj.controls.rotateSpeed = 5.5;
  renderObj.controls.zoomSpeed = 1.2;
  renderObj.controls.panSpeed = 0.8;
  renderObj.controls.staticMoving = true;
  renderObj.controls.dynamicDampingFactor = 0.3;

  // scene
  renderObj.scene = new THREE.Scene();

  // light
  renderObj.light = new THREE.DirectionalLight(0xffffff, 1);
  renderObj.light.position.copy(renderObj.camera.position);
  renderObj.scene.add(renderObj.light);

  // stats
  stats = new Stats();
  renderObj.domElement.appendChild(stats.domElement);
}

function initRenderer2D(rendererObj) {
  $('#' + rendererObj.domId).empty();
  // renderer
  rendererObj.domElement = document.getElementById(rendererObj.domId);
  rendererObj.renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  rendererObj.renderer.autoClear = false;
  rendererObj.renderer.localClippingEnabled = true;
  rendererObj.renderer.setSize(
    rendererObj.domElement.clientWidth,
    rendererObj.domElement.clientHeight
  );
  rendererObj.renderer.setClearColor(0x121212, 1);
  rendererObj.renderer.domElement.id = rendererObj.targetID;
  rendererObj.domElement.appendChild(rendererObj.renderer.domElement);

  // camera
  rendererObj.camera = new AMI.OrthographicCamera(
    rendererObj.domElement.clientWidth / -2,
    rendererObj.domElement.clientWidth / 2,
    rendererObj.domElement.clientHeight / 2,
    rendererObj.domElement.clientHeight / -2,
    1,
    1000
  );

  // controls
  rendererObj.controls = new AMI.TrackballOrthoControl(rendererObj.camera, rendererObj.domElement);
  rendererObj.controls.staticMoving = true;
  rendererObj.controls.noRotate = true;
  rendererObj.camera.controls = rendererObj.controls;


  // canvas 2D
  rendererObj.segCanvasDiv = document.getElementById(rendererObj.segCanvasId);
  rendererObj.segCanvas = document.createElement('canvas');
  rendererObj.segCanvas.setAttribute('width', rendererObj.segCanvasDiv.clientWidth);
  rendererObj.segCanvas.setAttribute('height', rendererObj.segCanvasDiv.clientHeight);
  rendererObj.segCanvas.setAttribute('id', 'canvas');
  rendererObj.segCanvasDiv.appendChild(rendererObj.segCanvas);
  rendererObj.segContext = rendererObj.segCanvas.getContext('2d');

  // scene
  rendererObj.scene = new THREE.Scene();
  rendererObj.segScene0 = new THREE.Scene();
  rendererObj.segScene1 = new THREE.Scene();

  // render to texture!!!!
  rendererObj.segSceneLayer0TextureTarget = new THREE.WebGLRenderTarget(rendererObj.domElement.clientWidth, rendererObj.domElement.clientHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
  });

  rendererObj.segSceneLayer1TextureTarget = new THREE.WebGLRenderTarget(rendererObj.domElement.clientWidth, rendererObj.domElement.clientHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
  });
}

function initHelpersStack(rendererObj, stack) {
  rendererObj.stackHelper = new AMI.StackHelper(stack);
  rendererObj.stackHelper.bbox.visible = false;
  rendererObj.stackHelper.borderColor = rendererObj.sliceColor;
  rendererObj.stackHelper.slice.canvasWidth = rendererObj.domElement.clientWidth;
  rendererObj.stackHelper.slice.canvasHeight = rendererObj.domElement.clientHeight;

  // set camera
  let worldbb = stack.worldBoundingBox();
  let lpsDims = new THREE.Vector3(
    (worldbb[1] - worldbb[0]) / 2,
    (worldbb[3] - worldbb[2]) / 2,
    (worldbb[5] - worldbb[4]) / 2
  );

  // box: {halfDimensions, center}
  let box = {
    center: stack.worldCenter().clone(),
    halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
  };

  // init and zoom
  let canvas = {
    width: rendererObj.domElement.clientWidth,
    height: rendererObj.domElement.clientHeight,
  };

  rendererObj.camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
  rendererObj.camera.box = box;
  rendererObj.camera.canvas = canvas;
  rendererObj.camera.orientation = rendererObj.sliceOrientation;
  rendererObj.camera.update();
  rendererObj.camera.fitBox(2, 1);

  rendererObj.stackHelper.orientation = rendererObj.camera.stackOrientation;
  rendererObj.stackHelper.index = Math.floor(rendererObj.stackHelper.orientationMaxIndex / 2);
  rendererObj.segScene0.add(rendererObj.stackHelper);

  // Create the Mix layer
  rendererObj.segUniformsLayerMix = AMI.LayerUniformShader.uniforms();
  rendererObj.segUniformsLayerMix.uTextureBackTest0.value = rendererObj.segSceneLayer0TextureTarget.texture;

  if (stack2) {
    rendererObj.segUniformsLayerMix.uTextureBackTest1.value = rendererObj.segSceneLayer1TextureTarget.texture;

    rendererObj.segTextures = [];
    for (let m = 0; m < stack2._rawData.length; m++) {
      let tex = new THREE.DataTexture(
        stack2.rawData[m],
        stack2.textureSize,
        stack2.textureSize,
        stack2.textureType,
        THREE.UnsignedByteType,
        THREE.UVMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.NearestFilter,
        THREE.NearestFilter
      );
      tex.needsUpdate = true;
      tex.flipY = true;
      rendererObj.segTextures.push(tex);
    }

    // create material && mesh then add it to sceneLayer1
    let uniformsLayer1 = AMI.DataUniformShader.uniforms();
    uniformsLayer1.uTextureSize.value = stack2.textureSize;
    uniformsLayer1.uTextureContainer.value = rendererObj.segTextures;
    uniformsLayer1.uWorldToData.value = stack2.lps2IJK;
    uniformsLayer1.uNumberOfChannels.value = stack2.numberOfChannels;
    uniformsLayer1.uPixelType.value = stack2.pixelType;
    uniformsLayer1.uBitsAllocated.value = stack2.bitsAllocated;
    uniformsLayer1.uPackedPerPixel.value = stack2.packedPerPixel;
    uniformsLayer1.uWindowCenterWidth.value = [stack2.windowCenter, stack2.windowWidth];
    uniformsLayer1.uRescaleSlopeIntercept.value = [stack2.rescaleSlope, stack2.rescaleIntercept];
    uniformsLayer1.uDataDimensions.value = [
      stack2.dimensionsIJK.x,
      stack2.dimensionsIJK.y,
      stack2.dimensionsIJK.z,
    ];
    uniformsLayer1.uInterpolation.value = 0;
    uniformsLayer1.uLowerUpperThreshold.value = [...stack2.minMax];

    // generate shaders on-demand!
    let fs = new AMI.DataFragmentShader(uniformsLayer1);
    let vs = new AMI.DataVertexShader();
    let materialLayer1 = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: uniformsLayer1,
      vertexShader: vs.compute(),
      fragmentShader: fs.compute(),
    });

    // add mesh in this scene with right shaders...
    rendererObj.segMeshLayer = new THREE.Mesh(rendererObj.stackHelper.slice.geometry, materialLayer1);
    // go the LPS space
    rendererObj.segMeshLayer.applyMatrix(stack._ijk2LPS);
    rendererObj.segScene1.add(rendererObj.segMeshLayer);

    let presetsSegmentation = new AMI.SegmentationPreset('Freesurfer');
    let lutLayer1 = new AMI.SegmentationLutHelper(
      'my-lut-canvases-l1', presetsSegmentation.preset
    );
    uniformsLayer1.uLutSegmentation.value = 1;
    uniformsLayer1.uTextureLUTSegmentation.value = lutLayer1.texture;
  }

  let fls = new AMI.LayerFragmentShader(rendererObj.segUniformsLayerMix);
  let vls = new AMI.LayerVertexShader();
  rendererObj.segMaterialLayerMix = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: rendererObj.segUniformsLayerMix,
    vertexShader: vls.compute(),
    fragmentShader: fls.compute(),
    transparent: true,
  });

  // add mesh in this scene with right shaders...
  rendererObj.segMeshLayerMix = new THREE.Mesh(rendererObj.stackHelper.slice.geometry, rendererObj.segMaterialLayerMix);
  // go the LPS space
  rendererObj.segMeshLayerMix.applyMatrix(stack._ijk2LPS);
  rendererObj.scene.add(rendererObj.segMeshLayerMix);
}

function initHelpersLocalizer(rendererObj, stack, referencePlane, localizers) {
  rendererObj.localizerHelper = new AMI.LocalizerHelper(
    stack,
    rendererObj.stackHelper.slice.geometry,
    referencePlane
  );

  for (let i = 0; i < localizers.length; i++) {
    rendererObj.localizerHelper['plane' + (i + 1)] = localizers[i].plane;
    rendererObj.localizerHelper['color' + (i + 1)] = localizers[i].color;
  }

  rendererObj.localizerHelper.canvasWidth = rendererObj.domElement.clientWidth;
  rendererObj.localizerHelper.canvasHeight = rendererObj.domElement.clientHeight;

  rendererObj.localizerScene = new THREE.Scene();
  rendererObj.localizerScene.add(rendererObj.localizerHelper);
}

function render() {
  // we are ready when both meshes have been loaded
  if (ready) {
    // render
    r0.controls.update();
    r1.controls.update();
    r2.controls.update();
    r3.controls.update();

    r0.light.position.copy(r0.camera.position);
    [r1, r2, r3].forEach(function (e) {
      r0.renderer.render(e.segScene0, r0.camera, e.segSceneLayer0TextureTarget, true);
      r0.renderer.render(e.segScene1, r0.camera, e.segSceneLayer1TextureTarget, true);
    });
    r0.renderer.render(r0.scene, r0.camera);

    [r1, r2, r3].forEach(function (e) {
      e.renderer.clear();
      e.renderer.render(e.segScene0, e.camera, e.segSceneLayer0TextureTarget, true);
      e.renderer.render(e.segScene1, e.camera, e.segSceneLayer1TextureTarget, true);
      e.renderer.render(e.scene, e.camera);

      // localizer
      e.renderer.clearDepth();
      e.renderer.render(e.localizerScene, e.camera);
    });
  }

  stats.update();
}

/**
 * Init the quadview
 */
function init() {
  /**
   * Called on each animation frame
   */
  function animate() {
    render();

    // request new frame
    requestAnimationFrame(function () {
      animate();
    });
  }

  // renderers
  initRenderer3D(r0);
  initRenderer2D(r1);
  initRenderer2D(r2);
  initRenderer2D(r3);
  // start rendering loop
  animate();
}

window.onload = function () {
  // init threeJS
  init();

  let files = ['../data-master/nifti/seg/T1stripvolume.nii.gz', '../data-master/nifti/seg/labels.nii.gz'];
  // let files = ['../data-master/5ec7f26248mri.nii.gz', '../data-master/5ec7f26248mri_label.nii.gz'];
  // let files = ['../data-master/patient21_T2.nii.gz', '../data-master/patient21_T2_manual.nii.gz'];

  labelChangeMap = new Map();

  function updateLabelMap(e, name) {
    let pre = e.data('pre');
    let current = e.val()
    e.data('pre', current);
    let initialDirection = e.data('initialDirection');
    //改变相同方向的select
    let oppoInitialDirectionSet = sameInitialDirectionMap.get(pairMap.get(initialDirection));
    if (oppoInitialDirectionSet != undefined) {
      oppoInitialDirectionSet.forEach(function (element, sameElement, set) {
        let e2 = $(element);
        e2.unbind('change');
        e2.data('pre', pairMap.get(current));
        e2.val(pairMap.get(current));
        e2.change(function (e3) {
          updateLabelMap($(this), '#' + e2.id);
        });

      });
    }
    //改变相反方向的select
    let sameInitialDirectionSet = sameInitialDirectionMap.get(initialDirection);
    if (sameInitialDirectionSet != undefined) {
      sameInitialDirectionSet.forEach(function (element, sameElement, set) {
        if (element !== name) {
          let e2 = $(element);
          e2.unbind('change');
          e2.data('pre', current);
          e2.val(current);
          e2.change(function (e3) {
            updateLabelMap($(this), '#' + e2.id);
          });
        }
      });
    }
    let sign = '-';
    if ((sameSignLabels1.has(pre) && sameSignLabels1.has(current)) || (sameSignLabels2.has(pre) && sameSignLabels2.has(current))) {
      sign = '+';
    }
    let label = 'x';
    switch (pre) {
      case 'R':
      case 'L':
        break;
      case 'A':
      case 'P':
        label = 'y';
        break;
      case 'I':
      case 'S':
        label = 'z';
        break;
      default:
        break;
    }
    let otherLabel = 'x';
    switch (current) {
      case 'R':
      case 'L':
        break;
      case 'A':
      case 'P':
        otherLabel = 'y';
        break;
      case 'I':
      case 'S':
        otherLabel = 'z';
        break;
      default:
        break;
    }
    labelChangeMap.set(label, otherLabel + '#' + sign);
  }

  // https://stackoverflow.com/questions/4076770/getting-value-of-select-dropdown-before-change
  function updateLabels(labels, numStr) {
    ['#top', '#bottom', '#right', '#left'].forEach(function (value, index, array) {
      let name = value + numStr;
      let direction = labels[index];
      $(name).val(direction);
      $(name).data('pre', direction);
      $(name).data('initialDirection', direction);
      let sameInitialDirectionSet = sameInitialDirectionMap.get(direction) == undefined ? new Set() : sameInitialDirectionMap.get(direction);
      if (!sameInitialDirectionSet.has(name)) {
        sameInitialDirectionSet.add(name);
        sameInitialDirectionMap.set(direction, sameInitialDirectionSet);
      }
      $(name).change(function () {
        updateLabelMap($(this), name);
      });
    });
  }

  function baseTask() {
    let series = baseLoader.data[0].mergeSeries(baseLoader.data);
    baseLoader.free();
    baseLoader = null;
    // get first stack from series
    let stack = series[0].stack[0];
    stack.prepare();

    // center 3d camera/control on the stack
    let centerLPS = stack.worldCenter();
    r0.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    r0.camera.updateProjectionMatrix();
    r0.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

    // bouding box
    let boxHelper = new AMI.BoundingBoxHelper(stack);
    r0.scene.add(boxHelper);

    // red slice
    initHelpersStack(r1, stack);
    r0.scene.add(r1.scene);
    updateLabels(r1.camera.directionsLabel, '1')

    // yellow slice
    initHelpersStack(r2, stack);
    r0.scene.add(r2.scene);
    updateLabels(r2.camera.directionsLabel, '2')

    // green slice
    initHelpersStack(r3, stack);
    r0.scene.add(r3.scene);
    updateLabels(r3.camera.directionsLabel, '3')

    // create new mesh with Localizer shaders
    let plane1 = r1.stackHelper.slice.cartesianEquation();
    let plane2 = r2.stackHelper.slice.cartesianEquation();
    let plane3 = r3.stackHelper.slice.cartesianEquation();

    // localizer red slice
    initHelpersLocalizer(r1, stack, plane1, [{
        plane: plane2,
        color: new THREE.Color(r2.stackHelper.borderColor)
      },
      {
        plane: plane3,
        color: new THREE.Color(r3.stackHelper.borderColor)
      },
    ]);

    // localizer yellow slice
    initHelpersLocalizer(r2, stack, plane2, [{
        plane: plane1,
        color: new THREE.Color(r1.stackHelper.borderColor)
      },
      {
        plane: plane3,
        color: new THREE.Color(r3.stackHelper.borderColor)
      },
    ]);

    // localizer green slice
    initHelpersLocalizer(r3, stack, plane3, [{
        plane: plane1,
        color: new THREE.Color(r1.stackHelper.borderColor)
      },
      {
        plane: plane2,
        color: new THREE.Color(r2.stackHelper.borderColor)
      },
    ]);

    let gui = new dat.GUI({
      autoPlace: false,
    });

    let customContainer = document.getElementById('my-gui-container');
    $('#my-gui-container').empty();
    customContainer.appendChild(gui.domElement);

    // Red
    let stackFolder1 = gui.addFolder('Axial (Red)');
    let redChanged = stackFolder1
      .add(r1.stackHelper, 'index', 0, r1.stackHelper.orientationMaxIndex)
      .step(1)
      .listen();
    let aa = {
      'x': 0,
      'y': 0,
      'z': 0
    };
    stackFolder1
      .add(r1.stackHelper.slice, 'interpolation', 0, 1)
      .step(1)
      .listen();

    // stackFolder1
    //   .add(r1.camera.position, 'x', -300, 300)
    //   .step(1)
    //   .onChange(function (v) {
    //     let dirLPS = new THREE.Vector3(
    //       r1.camera.position.x - r1.stackHelper.slice.planePosition.x,
    //       r1.camera.position.y - r1.stackHelper.slice.planePosition.y,
    //       r1.camera.position.z - r1.stackHelper.slice.planePosition.z
    //     ).normalize();
    //     r1.stackHelper.slice.planeDirection = dirLPS;
    //     r1.stackHelper.border.helpersSlice = r1.stackHelper.slice;
    //     console.log(r1.camera.position);
    //   });
    // stackFolder1
    //   .add(r1.camera.position, 'y', -300, 300)
    //   .step(1)
    //   .onChange(function (v) {
    //     let dirLPS = new THREE.Vector3(
    //       r1.camera.position.x - r1.stackHelper.slice.planePosition.x,
    //       r1.camera.position.y - r1.stackHelper.slice.planePosition.y,
    //       r1.camera.position.z - r1.stackHelper.slice.planePosition.z
    //     ).normalize();
    //     r1.stackHelper.slice.planeDirection = dirLPS;
    //     r1.stackHelper.border.helpersSlice = r1.stackHelper.slice;
    //   });
    // stackFolder1
    //   .add(r1.camera.position, 'z', -300, 300)
    //   .step(1)
    //   .onChange(function (v) {
    //     let dirLPS = new THREE.Vector3(
    //       r1.camera.position.x - r1.stackHelper.slice.planePosition.x,
    //       r1.camera.position.y - r1.stackHelper.slice.planePosition.y,
    //       r1.camera.position.z - r1.stackHelper.slice.planePosition.z
    //     ).normalize();
    //     r1.stackHelper.slice.planeDirection = dirLPS;
    //     r1.stackHelper.border.helpersSlice = r1.stackHelper.slice;
    //   });

    // Yellow
    let stackFolder2 = gui.addFolder('Sagittal (yellow)');
    let yellowChanged = stackFolder2
      .add(r2.stackHelper, 'index', 0, r2.stackHelper.orientationMaxIndex)
      .step(1)
      .listen();
    stackFolder2
      .add(r2.stackHelper.slice, 'interpolation', 0, 1)
      .step(1)
      .listen();

    // stackFolder2
    //   .add(r2.scene.rotation, 'x', -3, 3)
    //   .step(0.1)
    //   .onChange(function (v) {
    //     r2.scene.rotation.x = v;
    //     // r2.camera.rotate3d([v*180/Math.PI,null,null]);
    //   });
    // stackFolder2
    //   .add(r2.scene.rotation, 'y', -3, 3)
    //   .step(0.1)
    //   .onChange(function (v) {
    //     r2.scene.rotation.y = v;
    //     // r2.camera.rotate3d([null,v*180/Math.PI,null]);
    //   });
    // stackFolder2
    //   .add(r2.scene.rotation, 'z', -3, 3)
    //   .step(0.1)
    //   .onChange(function (v) {
    //     r2.scene.rotation.z = v;
    //   });
    // Green
    let stackFolder3 = gui.addFolder('Coronal (green)');
    let greenChanged = stackFolder3
      .add(r3.stackHelper, 'index', 0, r3.stackHelper.orientationMaxIndex)
      .step(1)
      .listen();
    stackFolder3
      .add(r3.stackHelper.slice, 'interpolation', 0, 1)
      .step(1)
      .listen();


    if (stack2) {
      let redOpacityLayerMix = stackFolder1.add({
        'seg opacity': 1.0
      }, 'seg opacity', 0, 1).step(0.01);
      redOpacityLayerMix.onChange(function (value) {
        r1.segUniformsLayerMix.uOpacity1.value = value;
      });

      let yellowOpacityLayerMix = stackFolder2.add({
        'seg opacity': 1.0
      }, 'seg opacity', 0, 1).step(0.01);
      yellowOpacityLayerMix.onChange(function (value) {
        r2.segUniformsLayerMix.uOpacity1.value = value;
      });

      let greenOpacityLayerMix = stackFolder3.add({
        'seg opacity': 1.0
      }, 'seg opacity', 0, 1).step(0.01);
      greenOpacityLayerMix.onChange(function (value) {
        r3.segUniformsLayerMix.uOpacity1.value = value;
      });

      // EDITOR FODLER
      let editorFolder = gui.addFolder('Editor');
      let editorOpen = editorFolder.add({
        'open': false
      }, 'open');
      editorOpen.onChange(function (value) {
        if (value) {
          isEditing = true;
          isDrawing = false;
          [r1, r2, r3].forEach(function (e) {
            e.segCanvasDiv.style = "pointer-events: all";
          });
        } else {
          isEditing = false;
          isDrawing = false;
          [r1, r2, r3].forEach(function (e) {
            e.segCanvasDiv.style = "pointer-events: none";
            clearCanvas(e.segContext);
          });
        }
      });
      editorFolder.add(cursor, 'size', 1, 50).step(1);
      let brushSegment = editorFolder.add(cursor, 'segment', segmentsList);
      brushSegment.onChange(function (value) {
        // update color and value
        cursor.value = segmentsDict[value].value;
        cursor.color = segmentsDict[value].color;
      });
    }
    /**
     * Update Layer Mix
     */
    function updateLocalizer(refObj, targetLocalizersHelpers) {
      let refHelper = refObj.stackHelper;
      let localizerHelper = refObj.localizerHelper;
      let plane = refHelper.slice.cartesianEquation();
      localizerHelper.referencePlane = plane;

      // bit of a hack... works fine for this application
      for (let i = 0; i < targetLocalizersHelpers.length; i++) {
        for (let j = 0; j < 3; j++) {
          let targetPlane = targetLocalizersHelpers[i]['plane' + (j + 1)];
          if (
            targetPlane &&
            plane.x.toFixed(6) === targetPlane.x.toFixed(6) &&
            plane.y.toFixed(6) === targetPlane.y.toFixed(6) &&
            plane.z.toFixed(6) === targetPlane.z.toFixed(6)
          ) {
            targetLocalizersHelpers[i]['plane' + (j + 1)] = plane;
          }
        }
      }

      // update the geometry will create a new mesh
      localizerHelper.geometry = refHelper.slice.geometry;
    }

    function updateSegLayer1(refObj) {
      // update layer1 geometry...
      if (refObj.segMeshLayer) {
        refObj.segMeshLayer.geometry.dispose();
        refObj.segMeshLayer.geometry = refObj.stackHelper.slice.geometry;
        refObj.segMeshLayer.geometry.verticesNeedUpdate = true;
      }
    }

    function updateSegLayerMix(refObj) {
      // update layer1 geometry...
      if (refObj.segMeshLayerMix) {
        refObj.scene.remove(refObj.segMeshLayerMix);
        refObj.segMeshLayerMix.material.dispose();
        refObj.segMeshLayerMix.material = null;
        refObj.segMeshLayerMix.geometry.dispose();
        refObj.segMeshLayerMix.geometry = null;

        // add mesh in this scene with right shaders...
        refObj.segMeshLayerMix = new THREE.Mesh(refObj.stackHelper.slice.geometry, refObj.segMaterialLayerMix);
        // go the LPS space
        refObj.segMeshLayerMix.applyMatrix(refObj.stackHelper.stack._ijk2LPS);
        refObj.scene.add(refObj.segMeshLayerMix);
      }
    }

    function updateSegIJKBBox(refObj) {
      refObj.segijkBBox = [stack2._columns, 0, stack2._rows, 0, stack2.frame.length, 0];

      // IJK BBox of the plane
      let slice = refObj.stackHelper._slice;
      let vertices = slice._geometry.vertices;
      // to LPS
      for (let i = 0; i < vertices.length; i++) {
        let wc = new THREE.Vector3(vertices[i].x, vertices[i].y, vertices[i].z).applyMatrix4(
          refObj.stackHelper.stack._ijk2LPS
        );
        let dc = wc.applyMatrix4(stack2._lps2IJK);
        dc.x = Math.round(dc.x * 10) / 10;
        dc.y = Math.round(dc.y * 10) / 10;
        dc.z = Math.round(dc.z * 10) / 10;

        if (dc.x < refObj.segijkBBox[0]) {
          refObj.segijkBBox[0] = dc.x;
        }
        if (dc.x > refObj.segijkBBox[1]) {
          refObj.segijkBBox[1] = dc.x;
        }

        // Y
        if (dc.y < refObj.segijkBBox[2]) {
          refObj.segijkBBox[2] = dc.y;
        }
        if (dc.y > refObj.segijkBBox[3]) {
          refObj.segijkBBox[3] = dc.y;
        }

        // Z
        if (dc.z < refObj.segijkBBox[4]) {
          refObj.segijkBBox[4] = dc.z;
        }
        if (dc.z > refObj.segijkBBox[5]) {
          refObj.segijkBBox[5] = dc.z;
        }
      }

      // round min up and max down
      refObj.segijkBBox[0] = Math.ceil(refObj.segijkBBox[0]);
      refObj.segijkBBox[2] = Math.ceil(refObj.segijkBBox[2]);
      refObj.segijkBBox[4] = Math.ceil(refObj.segijkBBox[4]);
      refObj.segijkBBox[1] = Math.floor(refObj.segijkBBox[1]);
      refObj.segijkBBox[3] = Math.floor(refObj.segijkBBox[3]);
      refObj.segijkBBox[5] = Math.floor(refObj.segijkBBox[5]);
    }

    function onYellowChanged() {
      updateLocalizer(r2, [r1.localizerHelper, r3.localizerHelper]);
      if (stack2) {
        updateSegLayer1(r2);
        updateSegLayerMix(r2);
        updateSegIJKBBox(r2);
      }
    }

    yellowChanged.onChange(onYellowChanged);

    function onRedChanged() {
      updateLocalizer(r1, [r2.localizerHelper, r3.localizerHelper]);
      if (stack2) {
        updateSegLayer1(r1);
        updateSegLayerMix(r1);
        updateSegIJKBBox(r1);
      }
    }

    redChanged.onChange(onRedChanged);

    function onGreenChanged() {
      updateLocalizer(r3, [r1.localizerHelper, r2.localizerHelper]);
      if (stack2) {
        updateSegLayer1(r3);
        updateSegLayerMix(r3);
        updateSegIJKBBox(r3);
      }
    }

    greenChanged.onChange(onGreenChanged);

    function onDoubleClick(event) {
      const canvas = event.target.parentElement.parentElement;
      const id = event.target.id;
      const mouse = {
        x: ((event.clientX - canvas.offsetLeft) / canvas.clientWidth) * 2 - 1,
        y: -((event.clientY - canvas.offsetTop) / canvas.clientHeight) * 2 + 1,
      };
      //
      let camera = null;
      let stackHelper = null;
      let scene = null;
      switch (id) {
        case '0':
          camera = r0.camera;
          stackHelper = r1.stackHelper;
          scene = r0.scene;
          break;
        case '1':
          camera = r1.camera;
          stackHelper = r1.stackHelper;
          scene = r1.scene;
          break;
        case '2':
          camera = r2.camera;
          stackHelper = r2.stackHelper;
          scene = r2.scene;
          break;
        case '3':
          camera = r3.camera;
          stackHelper = r3.stackHelper;
          scene = r3.scene;
          break;
      }

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        let ijk = AMI.UtilsCore.worldToData(stackHelper.stack.lps2IJK, intersects[0].point);

        r1.stackHelper.index = ijk.getComponent((r1.stackHelper.orientation + 2) % 3);
        r2.stackHelper.index = ijk.getComponent((r2.stackHelper.orientation + 2) % 3);
        r3.stackHelper.index = ijk.getComponent((r3.stackHelper.orientation + 2) % 3);

        onGreenChanged();
        onRedChanged();
        onYellowChanged();
      }
    }

    // event listeners
    r0.domElement.addEventListener('dblclick', onDoubleClick);
    r1.domElement.addEventListener('dblclick', onDoubleClick);
    r2.domElement.addEventListener('dblclick', onDoubleClick);
    r3.domElement.addEventListener('dblclick', onDoubleClick);


    function onScroll(event) {
      const id = event.target.domElement.id;
      let stackHelper = null;
      switch (id) {
        case 'r1':
          stackHelper = r1.stackHelper;
          break;
        case 'r2':
          stackHelper = r2.stackHelper;
          break;
        case 'r3':
          stackHelper = r3.stackHelper;
          break;
      }

      if (event.delta > 0) {
        if (stackHelper.index >= stackHelper.orientationMaxIndex - 1) {
          return false;
        }
        stackHelper.index += 1;
      } else {
        if (stackHelper.index <= 0) {
          return false;
        }
        stackHelper.index -= 1;
      }

      onGreenChanged();
      onRedChanged();
      onYellowChanged();
    }

    // event listeners
    r1.controls.addEventListener('OnScroll', onScroll);
    r2.controls.addEventListener('OnScroll', onScroll);
    r3.controls.addEventListener('OnScroll', onScroll);

    function windowResize2D(rendererObj) {
      rendererObj.camera.canvas = {
        width: rendererObj.domElement.clientWidth,
        height: rendererObj.domElement.clientHeight,
      };
      rendererObj.camera.fitBox(2, 1);
      rendererObj.renderer.setSize(
        rendererObj.domElement.clientWidth,
        rendererObj.domElement.clientHeight
      );

      // update info to draw borders properly
      rendererObj.stackHelper.slice.canvasWidth = rendererObj.domElement.clientWidth;
      rendererObj.stackHelper.slice.canvasHeight = rendererObj.domElement.clientHeight;
      rendererObj.localizerHelper.canvasWidth = rendererObj.domElement.clientWidth;
      rendererObj.localizerHelper.canvasHeight = rendererObj.domElement.clientHeight;
    }

    function onWindowResize() {
      // update 3D
      r0.camera.aspect = r0.domElement.clientWidth / r0.domElement.clientHeight;
      r0.camera.updateProjectionMatrix();
      r0.renderer.setSize(r0.domElement.clientWidth, r0.domElement.clientHeight);

      // update 2d
      windowResize2D(r1);
      windowResize2D(r2);
      windowResize2D(r3);
    }

    window.addEventListener('resize', onWindowResize, false);
    if (stack2) {
      [r1, r2, r3].forEach(function (e) {
        updateSegIJKBBox(e);
      });
      setupEditor();
    }
    ready = true;

    // force 1st render
    render();
    // notify puppeteer to take screenshot
    // const puppetDiv = document.createElement('div');
    // puppetDiv.setAttribute('id', 'puppeteer');
    // document.body.appendChild(puppetDiv);
  }


  let fileDict = {
    'source': ['../data-master/nifti/seg/T1stripvolume.nii.gz'],
    'seg': ['../data-master/nifti/seg/labels.nii.gz']
  };

  // load sequence for each file
  // instantiate the loader
  // it loads and parses the dicom image
  let baseLoader = new AMI.VolumeLoader();

  if (fileDict.seg) {
    let segLoader = new AMI.VolumeLoader();
    segLoader.load(fileDict.seg).then(function () {
        let series = segLoader.data[0].mergeSeries(segLoader.data);
        segLoader.free();
        segLoader = null;
        // get first stack from series
        stack2 = series[0].stack[0];
        stack2.prepare();
        // pixels packing for the fragment shaders now happens there
        stack2.pack();
      })
      .then(function () {
        baseLoader
          .load(fileDict.source)
          .then(function () {
            baseTask();
          })
          .catch(function (error) {
            window.console.log('oops... something went wrong...');
            window.console.log(error);
          });
      })
      .catch(function (error) {
        window.console.log('oops... something went wrong...');
        window.console.log(error);
      });
  } else {
    baseLoader
      .load(fileDict.source)
      .then(function () {
        baseTask();
      })
      .catch(function (error) {
        window.console.log('oops... something went wrong...');
        window.console.log(error);
      });
  }
};