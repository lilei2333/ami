// standard global variables
let controls;
let renderer;
let camera;
let threeD;
let sceneLayer0TextureTarget;
let sceneLayer1TextureTarget;
let sceneLayer0;
// let lutLayer0;
let sceneLayer1;
let meshLayer1;
let uniformsLayer1;
let materialLayer1;
let lutLayer1;
let sceneLayerMix;
let meshLayerMix;
let uniformsLayerMix;
let materialLayerMix;
let stackHelper;
let stack2;
let textures2;
let ijkBBox = [99999999, 0, 9999999, 0, 999999999, 0];
let layerMix = {
  opacity1: 1.0,
  lut: null,
};
let canvas;
let canvasDiv;
let context;
let lastPoint = null;
let currentPoint = null;
let isEditing = false;
let isDrawing = false;
let cursor = {
  color: '#d9d9d9',
  value: 0,
  size: 15,
  shape: 'round',
  segment: 'erase',
};
let segmentsList = [];
let segmentsDict = {};
// let firstRender = false;

// FUNCTIONS
/**
 *
 */
function setupEditor() {
  /**
   *
   */
  function distanceBetween(point1, point2) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  }

  /**
   *
   */
  function angleBetween(point1, point2) {
    return Math.atan2(point2.x - point1.x, point2.y - point1.y);
  }


  /**
   *  Loop through IJK BBox and see if voxel can be mapped to screen
   */
  function mapCanvasToData() {
    for (let i = ijkBBox[0]; i < ijkBBox[1] + 1; i++) {
      for (let j = ijkBBox[2]; j < ijkBBox[3] + 1; j++) {
        for (let k = ijkBBox[4]; k < ijkBBox[5] + 1; k++) {
          // ijk to world
          // center of voxel
          let worldCoordinate = new THREE.Vector3(i, j, k).applyMatrix4(stack2._ijk2LPS);
          // world to screen coordinate
          let screenCoordinates = worldCoordinate.clone();
          screenCoordinates.project(camera);

          screenCoordinates.x = Math.round(((screenCoordinates.x + 1) * canvas.offsetWidth) / 2);
          screenCoordinates.y = Math.round(((-screenCoordinates.y + 1) * canvas.offsetHeight) / 2);
          screenCoordinates.z = 0;

          let pixel = context.getImageData(screenCoordinates.x, screenCoordinates.y, 1, 1).data;
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
                  textures2[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                  textures2[rawDataIndex].needsUpdate = true;
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
                  textures2[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                  textures2[rawDataIndex].needsUpdate = true;
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
                  textures2[rawDataIndex].image.data = stack2.rawData[rawDataIndex]; // tex;
                  textures2[rawDataIndex].needsUpdate = true;
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

  /**
   *
   */
  function drawCircle(x, y) {
    context.beginPath();
    context.arc(x, y, cursor.size, false, Math.PI * 2, false);
    context.closePath();
    context.fill();
    context.stroke();
  }

  /**
   *
   */
  function clearCanvas() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  }

  /**
   *
   */
  function addEventListeners() {
    /**
     *
     */
    function onMouseDown(e) {
      if (!isEditing) return;

      isDrawing = true;
      lastPoint = {
        x: e.pageX - canvasDiv.offsetLeft,
        y: e.pageY - canvasDiv.offsetTop,
      };
    }

    /**
     *
     */
    function onMouseMove(e) {
      if (!isEditing) return;

      currentPoint = {
        x: e.pageX - canvasDiv.offsetLeft,
        y: e.pageY - canvasDiv.offsetTop,
      };

      context.strokeStyle = cursor.color;
      context.globalCompositeOperation = 'xor';
      context.globalAlpha = 0.5;
      context.fillStyle = cursor.color;

      if (isDrawing) {
        let dist = distanceBetween(lastPoint, currentPoint);
        let angle = angleBetween(lastPoint, currentPoint);

        for (let i = 0; i < dist; i += 5) {
          let x = lastPoint.x + Math.sin(angle) * i;
          let y = lastPoint.y + Math.cos(angle) * i;
          drawCircle(x, y);
        }

        lastPoint = currentPoint;
      } else {
        clearCanvas();
      }

      // draw under the cursor
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      drawCircle(currentPoint.x, currentPoint.y);
    }

    /**
     *
     */
    function onMouseUp(e) {
      if (!isEditing) return;

      isDrawing = false;
      mapCanvasToData();
      clearCanvas();
      // draw cursor under mouse
      onMouseMove(e);
    }

    /**
     *
     */
    // function updateDOM() {
    //   // lets events go through or not for scrolling, padding, zooming, etc.
    //   if (isEditing) {
    //     canvasDiv.className = 'editing';
    //     document.getElementById('help').style.display = 'none';
    //   } else {
    //     canvasDiv.className = 'exploring';
    //     document.getElementById('help').style.display = 'block';
    //   }
    // }

    /**
     *
     */
    // function onKeyDown(e) {
    //   if (e.keyCode === 17) {
    //     isEditing = true;
    //     isDrawing = false;
    //     updateDOM();
    //   }
    // }

    // /**
    //  *
    //  */
    // function onKeyUp(e) {
    //   if (e.keyCode === 17) {
    //     isEditing = false;
    //     isDrawing = false;
    //     clearCanvas();
    //     updateDOM();
    //   }
    // }

    /**
     *
     */
    function disableRightClick(e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // add events listeners
    canvasDiv.addEventListener('mousedown', onMouseDown, false);
    canvasDiv.addEventListener('mousemove', onMouseMove, false);
    canvasDiv.addEventListener('mouseup', onMouseUp, false);
    // window.addEventListener('keydown', onKeyDown, false);
    // window.addEventListener('keyup', onKeyUp, false);
    canvasDiv.addEventListener('contextmenu', disableRightClick, false);
  }

  addEventListeners();
}

function render() {
  // render
  controls.update();
  // render first layer offscreen
  renderer.render(sceneLayer0, camera, sceneLayer0TextureTarget, true);
  // render second layer offscreen
  renderer.render(sceneLayer1, camera, sceneLayer1TextureTarget, true); //TODO 0 1
  // mix the layers and render it ON screen!
  renderer.render(sceneLayerMix, camera);
}

/**
 *
 */
function init() {
  document.getElementById("my-lut-canvases-l1").style = "display:none";
  /**
   *
   */
  function animate() {
    render();

    // request new frame
    requestAnimationFrame(function () {
      animate();
    });
  }

  // renderer
  threeD = document.getElementById('r3d');
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(threeD.clientWidth, threeD.clientHeight);
  renderer.setClearColor(0x607d8b, 1);

  threeD.appendChild(renderer.domElement);

  // canvas 2D
  canvasDiv = document.getElementById('canvasDiv');
  canvas = document.createElement('canvas');
  canvas.setAttribute('width', canvasDiv.clientWidth);
  canvas.setAttribute('height', canvasDiv.clientHeight);
  canvas.setAttribute('id', 'canvas');
  canvasDiv.appendChild(canvas);
  context = canvas.getContext('2d');

  // scene
  sceneLayer0 = new THREE.Scene();
  sceneLayer1 = new THREE.Scene();
  sceneLayerMix = new THREE.Scene();

  // render to texture!!!!
  sceneLayer0TextureTarget = new THREE.WebGLRenderTarget(threeD.clientWidth, threeD.clientHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
  });

  sceneLayer1TextureTarget = new THREE.WebGLRenderTarget(threeD.clientWidth, threeD.clientHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
  });

  // camera
  camera = new AMI.OrthographicCamera(
    threeD.clientWidth / -2,
    threeD.clientWidth / 2,
    threeD.clientHeight / 2,
    threeD.clientHeight / -2,
    0.1,
    10000
  );

  // controls
  controls = new AMI.TrackballOrthoControl(camera, threeD);
  controls.staticMoving = true;
  controls.noRotate = true;
  camera.controls = controls;

  animate();
}

window.onload = function () {
  // init threeJS...
  init();
  /**
   *
   */
  function updateLayer1() {
    // update layer1 geometry...
    if (meshLayer1) {
      meshLayer1.geometry.dispose();
      meshLayer1.geometry = stackHelper.slice.geometry;
      meshLayer1.geometry.verticesNeedUpdate = true;
    }
  }

  /**
   *
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
      meshLayerMix = new THREE.Mesh(stackHelper.slice.geometry, materialLayerMix);
      // go the LPS space
      meshLayerMix.applyMatrix(stackHelper.stack._ijk2LPS);

      sceneLayerMix.add(meshLayerMix);
    }
  }

  /**
   *
   */
  function updateIJKBBox() {
    ijkBBox = [stack2._columns, 0, stack2._rows, 0, stack2.frame.length, 0];

    // IJK BBox of the plane
    let slice = stackHelper._slice;
    let vertices = slice._geometry.vertices;
    // to LPS
    for (let i = 0; i < vertices.length; i++) {
      let wc = new THREE.Vector3(vertices[i].x, vertices[i].y, vertices[i].z).applyMatrix4(
        stackHelper.stack._ijk2LPS
      );
      let dc = wc.applyMatrix4(stack2._lps2IJK);
      dc.x = Math.round(dc.x * 10) / 10;
      dc.y = Math.round(dc.y * 10) / 10;
      dc.z = Math.round(dc.z * 10) / 10;

      if (dc.x < ijkBBox[0]) {
        ijkBBox[0] = dc.x;
      }
      if (dc.x > ijkBBox[1]) {
        ijkBBox[1] = dc.x;
      }

      // Y
      if (dc.y < ijkBBox[2]) {
        ijkBBox[2] = dc.y;
      }
      if (dc.y > ijkBBox[3]) {
        ijkBBox[3] = dc.y;
      }

      // Z
      if (dc.z < ijkBBox[4]) {
        ijkBBox[4] = dc.z;
      }
      if (dc.z > ijkBBox[5]) {
        ijkBBox[5] = dc.z;
      }
    }

    // round min up and max down
    ijkBBox[0] = Math.ceil(ijkBBox[0]);
    ijkBBox[2] = Math.ceil(ijkBBox[2]);
    ijkBBox[4] = Math.ceil(ijkBBox[4]);
    ijkBBox[1] = Math.floor(ijkBBox[1]);
    ijkBBox[3] = Math.floor(ijkBBox[3]);
    ijkBBox[5] = Math.floor(ijkBBox[5]);
  }

  function clearCanvas2() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  }
  /**
   *
   */
  function setupGUI() {
    updateIJKBBox();

    // BUILD THE GUI
    let gui = new dat.GUI({
      autoPlace: false,
    });
    let customContainer = document.getElementById('my-gui-container');
    customContainer.appendChild(gui.domElement);

    // PET FOLDER
    let layer0Folder = gui.addFolder('PET');

    let indexUpdate = layer0Folder
      .add(stackHelper, 'index', 1, 181)
      .step(1)
      .listen();
    indexUpdate.onChange(function () {
      updateLayer1();
      updateLayerMix();
      updateIJKBBox();
    });

    let updateInterpolation = layer0Folder.add(stackHelper.slice, 'interpolation');
    updateInterpolation.onChange(function (value) {
      if (value) {
        stackHelper.slice.interpolation = 1;
      } else {
        stackHelper.slice.interpolation = 0;
      }
    });
    layer0Folder.open();

    // SEGMENTATION FOLDER
    let layerMixFolder = gui.addFolder('Segmentation');

    let opacityLayerMix1 = layerMixFolder.add(layerMix, 'opacity1', 0, 1).step(0.01);
    opacityLayerMix1.onChange(function (value) {
      uniformsLayerMix.uOpacity1.value = value;
    });

    layerMixFolder.open();

    // EDITOR FODLER
    let editorFolder = gui.addFolder('Editor');
    let editorOpen = editorFolder.add({
      'open': false
    }, 'open');
    editorOpen.onChange(function (value) {
      if (value) {
        canvasDiv.className = 'editing';
        isEditing = true;
        isDrawing = false;
      } else {
        canvasDiv.className = 'exploring';
        isEditing = false;
        isDrawing = false;
        clearCanvas2();
      }
    });
    editorFolder.add(cursor, 'size', 1, 50).step(1);
    let brushSegment = editorFolder.add(cursor, 'segment', segmentsList);
    brushSegment.onChange(function (value) {
      // update color and value
      cursor.value = segmentsDict[value].value;
      cursor.color = segmentsDict[value].color;
    });
    editorFolder.open();
  }

  /**
   *
   */
  function addListeners() {
    /**
     *
     */
    function onScroll(e) {
      if (e.delta > 0) {
        if (stackHelper.index >= 181) {
          return false;
        }
        stackHelper.index += 1;
      } else {
        if (stackHelper.index <= 1) {
          return false;
        }
        stackHelper.index -= 1;
      }

      updateLayer1();
      updateLayerMix();
      updateIJKBBox();
    }

    /**
     *
     */
    function onWindowResize() {
      let threeD = document.getElementById('r3d');
      camera.canvas = {
        width: threeD.clientWidth,
        height: threeD.clientHeight,
      };
      camera.fitBox(2);

      renderer.setSize(threeD.clientWidth, threeD.clientHeight);

      canvas.setAttribute('width', canvasDiv.clientWidth);
      canvas.setAttribute('height', canvasDiv.clientHeight);
    }
    onWindowResize();

    controls.addEventListener('OnScroll', onScroll);
    window.addEventListener('resize', onWindowResize, false);
  }

  /**
   *
   */
  function handleSeries() {
    //
    //
    // first stack of first series
    let mergedSeries = loader.data[0].mergeSeries(loader.data);
    loader.free();
    loader = null;

    let stack = mergedSeries[0].stack[0];
    stack2 = mergedSeries[1].stack[0];

    if (mergedSeries[0].seriesInstanceUID === '../data-master/nifti/seg/labels.nii.gz') {
      stack = mergedSeries[1].stack[0];
      stack2 = mergedSeries[0].stack[0];
    }

    stackHelper = new AMI.StackHelper(stack);
    stackHelper.bbox.visible = false;
    stackHelper.border.visible = false;
    stackHelper.index = 90;
    stackHelper.slice.interpolation = false;

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

    textures2 = [];
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
      textures2.push(tex);
    }

    // create material && mesh then add it to sceneLayer1
    uniformsLayer1 = AMI.DataUniformShader.uniforms();
    uniformsLayer1.uTextureSize.value = stack2.textureSize;
    uniformsLayer1.uTextureContainer.value = textures2;
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
    uniformsLayerMix = AMI.LayerUniformShader.uniforms();
    uniformsLayerMix.uTextureBackTest0.value = sceneLayer0TextureTarget.texture;
    uniformsLayerMix.uTextureBackTest1.value = sceneLayer1TextureTarget.texture; //TODO 0 1

    let fls = new AMI.LayerFragmentShader(uniformsLayerMix);
    let vls = new AMI.LayerVertexShader();
    materialLayerMix = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: uniformsLayerMix,
      vertexShader: vls.compute(),
      fragmentShader: fls.compute(),
      transparent: true,
    });

    // add mesh in this scene with right shaders...
    meshLayerMix = new THREE.Mesh(stackHelper.slice.geometry, materialLayerMix);
    // go the LPS space
    meshLayerMix.applyMatrix(stack._ijk2LPS);
    sceneLayerMix.add(meshLayerMix);

    //
    // set camera
    let worldbb = stack.worldBoundingBox();
    let lpsDims = new THREE.Vector3(
      worldbb[1] - worldbb[0],
      worldbb[3] - worldbb[2],
      worldbb[5] - worldbb[4]
    );

    // box: {halfDimensions, center}
    let box = {
      center: stack.worldCenter().clone(),
      halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
    };

    // init and zoom
    let canvas = {
      width: threeD.clientWidth,
      height: threeD.clientHeight,
    };
    camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
    camera.box = box;
    camera.canvas = canvas;
    camera.update();
    camera.fitBox(2);

    // CREATE LUT
    // lutLayer0 = new AMI.LutHelper(
    //   'my-lut-canvases-l0',
    //   'default',
    //   'linear',
    //   [[0, 0, 0, 0], [1, 1, 1, 1]],
    //   [[0, 1], [1, 1]]
    // );
    // lutLayer0.luts = AMI.LutHelper.presetLuts();
    // lutLayer0.lut = 'random';
    // stackHelper.slice.lut = 1;
    // stackHelper.slice.lutTexture = lutLayer0.texture;

    var presetsSegmentation = new AMI.SegmentationPreset('Freesurfer');
    lutLayer1 = new AMI.SegmentationLutHelper(
      'my-lut-canvases-l1', presetsSegmentation.preset
    );
    uniformsLayer1.uLutSegmentation.value = 1;
    uniformsLayer1.uTextureLUTSegmentation.value = lutLayer1.texture;

    // store segments info
    // add "eraser"
    segmentsList = ['erase', 'yellow'];
    segmentsDict = {
      erase: {
        color: '#d9d9d9',
        value: 0,
      },
      yellow: {
        color: '#cfdb0d',
        value: 1,
      },
    };

    // add labels
    for (let i = 0; i < stack2._segmentationSegments.length; i++) {
      let label = stack2._segmentationSegments[i].segmentLabel;
      let number = stack2._segmentationSegments[i].segmentNumber;
      segmentsList.push(label);
      segmentsDict[label] = {
        color: `rgba(
          ${Math.round(stack2._segmentationLUT[number][1] * 255)},
          ${Math.round(stack2._segmentationLUT[number][2] * 255)},
          ${Math.round(stack2._segmentationLUT[number][3] * 255)},
          1)`,
        value: number,
      };
    }
  }

  let files = ['../data-master/nifti/seg/T1stripvolume.nii.gz', '../data-master/nifti/seg/labels.nii.gz'];
  // let files = ['../data-master/5ec7f26248mri.nii.gz', '../data-master/5ec7f26248mri_label.nii.gz'];

  let loader = new AMI.VolumeLoader(threeD);

  loader
    .load(files)
    .then(function () {
      handleSeries();
      addListeners();
      setupGUI();
      setupEditor();
      // force 1st render
      render();
      // notify puppeteer to take screenshot
      // const puppetDiv = document.createElement('div');
      // puppetDiv.setAttribute('id', 'puppeteer');
      // document.body.appendChild(puppetDiv);
    })
    .catch(function (error) {
      window.console.log('oops... something went wrong...');
      window.console.log(error);
    });
};