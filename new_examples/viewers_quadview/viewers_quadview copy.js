// standard global variables
let stats;
let ready = false;
let labelChangeMap = new Map();
const sameSignLabels1 = new Set(['R', 'A', 'I']);
const sameSignLabels2 = new Set(['L', 'P', 'S']);
let sameInitialDirectionMap = new Map();

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
};


function initRenderer3D(renderObj) {
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

  // scene
  rendererObj.scene = new THREE.Scene();
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
  // if(rendererObj.domId === 'r2'){
  // rendererObj.scene.add(rendererObj.camera);
  // }
  rendererObj.scene.add(rendererObj.stackHelper);
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
    r0.renderer.render(r0.scene, r0.camera);

    // r1
    r1.renderer.clear();
    r1.renderer.render(r1.scene, r1.camera);

    // localizer
    r1.renderer.clearDepth();
    r1.renderer.render(r1.localizerScene, r1.camera);

    // r2
    r2.renderer.clear();
    r2.renderer.render(r2.scene, r2.camera);
    r2.renderer.clearDepth();
    r2.renderer.render(r2.localizerScene, r2.camera);

    // r3
    r3.renderer.clear();
    r3.renderer.render(r3.scene, r3.camera);
    r3.renderer.clearDepth();
    r3.renderer.render(r3.localizerScene, r3.camera);
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

  let files = ['../data-master/output.nii.gz'];

  function updateLabelMap(e, name) {
    let pre = e.data('pre');
    let current = e.val()
    e.data('pre', current);
    let initialDirection = e.data('initialDirection');
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

  // load sequence for each file
  // instantiate the loader
  // it loads and parses the dicom image
  let loader = new AMI.VolumeLoader();
  loader
    .load(files)
    .then(function () {
      let series = loader.data[0].mergeSeries(loader.data);
      loader.free();
      loader = null;
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

      function onYellowChanged() {
        updateLocalizer(r2, [r1.localizerHelper, r3.localizerHelper]);
      }

      yellowChanged.onChange(onYellowChanged);

      function onRedChanged() {
        updateLocalizer(r1, [r2.localizerHelper, r3.localizerHelper]);
      }

      redChanged.onChange(onRedChanged);

      function onGreenChanged() {
        updateLocalizer(r3, [r1.localizerHelper, r2.localizerHelper]);
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

      ready = true;

      // force 1st render
      render();
      // notify puppeteer to take screenshot
      const puppetDiv = document.createElement('div');
      puppetDiv.setAttribute('id', 'puppeteer');
      document.body.appendChild(puppetDiv);
    })
    .catch(function (error) {
      window.console.log('oops... something went wrong...');
      window.console.log(error);
    });
};