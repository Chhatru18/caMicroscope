let $CAMIC = null;
const $UI = {};
const $D = {
  pages: {
    home: '../apps/table.html',
    table: '../apps/table.html'
  },
  params: null // parameter from url - slide Id and status in it (object).
};

let PDR = OpenSeadragon.pixelDensityRatio;
console.log('pixelDensityRatio:', PDR);

/**
 * Toolbar button callback
 * @param e
 */
function drawRectangle(e) {

  let canvas = $CAMIC.viewer.drawer.canvas; //Original Canvas
  canvas.style.cursor = e.checked ? 'crosshair' : 'default';

  const canvasDraw = $CAMIC.viewer.canvasDrawInstance;
  canvasDraw.drawMode = 'rect';
  canvasDraw.style.color = '#FFFF00';
  canvasDraw.style.isFill = false;

  if (e.checked) {
    canvasDraw.drawOn();

  } else {
    canvasDraw.drawOff();

  }

}

/**
 * Get pixels to create image (pass to ImageJs)
 * @param event
 */
function camicStopDraw(e) {

  //let main_viewer = document.getElementById('main_viewer');
  //let clickPos = getClickPosition(e, main_viewer);

  const viewer = $CAMIC.viewer;
  const canvasDraw = viewer.canvasDrawInstance;

  let imgColl = canvasDraw.getImageFeatureCollection();

  if (imgColl.features.length > 0) {

    // Check size first
    let box = checkSize(imgColl, viewer.imagingHelper);

    if (Object.keys(box).length === 0 && box.constructor === Object) {

    }
    else
    {
      testDraw(box); // Draw then create file
    }

  } else {
    console.error('Could not get feature collection.')
  }

}

function checkSize(imgColl, imagingHelper) {

  // 5x2 array
  let bound = imgColl.features[0].bound;

  // Convert to screen coordinates
  let foo = convertCoordinates(imagingHelper, bound);

  //retina screen
  let newArray = foo.map(function (a) {
    let x = a.slice();
    x[0] *= PDR;
    x[1] *= PDR; // need to adjust, try layer
    return x;
  });
  console.log('bounds', newArray);

  const xCoord = newArray[0][0];
  const yCoord = newArray[0][1];

  let width = (newArray[2][0] - xCoord);
  let height = (newArray[2][1] - yCoord);

  console.log('width, height:\n', width, height);

  // check that image size is ok
  if (width * height > 4000000) {
    alert("Selected ROI too large, current version is limited to 4 megapixels");
    // Clear the rectangle  canvas-draw-overlay.clear()
    $CAMIC.viewer.canvasDrawInstance.clear();
    return {}; //throw('image too large')
  } else {
    return {'xCoord': xCoord, 'yCoord': yCoord, 'width': width, 'height': height};
  }
}


function testDraw(box) {
  let camicanv = $CAMIC.viewer.drawer.canvas; //Original Canvas

  let imgData = (camicanv.getContext('2d')).getImageData(box.xCoord, box.yCoord, box.width, box.height);

  // Draw as canvas
  let canvas = document.createElement('canvas');
  canvas.id = 'myCanvas';
  canvas.style.border = "thick solid #0000FF";
  canvas.width = imgData.width;
  canvas.height = imgData.height;

  let context = canvas.getContext("2d");
  context.putImageData(imgData, 0, 0);
  document.body.appendChild(canvas);

  let dataURL = canvas.toDataURL("image/png");

  let blob = dataURItoBlob(dataURL);

  let filename = 'testing';

  let f = new File([blob], filename, {type: blob.type});
  console.log(f);

  // Start file download.
  download(filename, dataURL);

}

/**
 * Check file creation
 *
 * @param filename
 * @param dataURL
 */
function download(filename, dataURL) {
  var element = document.createElement('a');
  element.setAttribute('href', dataURL);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}


/**
 * Convert a dataURI to a Blob
 *
 * @param dataURI
 * @returns {Blob}
 */
function dataURItoBlob(dataURI) {
  // convert base64/URLEncoded data component to raw binary data held in a string
  let byteString;
  if (dataURI.split(',')[0].indexOf('base64') >= 0)
    byteString = atob(dataURI.split(',')[1]);
  else
    byteString = unescape(dataURI.split(',')[1]);

  // separate out the mime component
  let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to a typed array
  let ia = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ia], {type: mimeString});
}


/**
 * Convert image coordinates
 */
function convertCoordinates(imagingHelper, bound) {

  let newArray = bound.map(function (arr) {
    return arr.slice(); // copy
  });

  // 'image coordinate' to 'screen coordinate'
  for (let i = 0; i < newArray.length; i++) {
    let boundElement = newArray[i];
    for (let j = 0; j < boundElement.length; j++) {
      newArray[i][j] = j === 0 ? imagingHelper.dataToPhysicalX(boundElement[j])
          : imagingHelper.dataToPhysicalY(boundElement[j]);
    }
  }

  return newArray;

}


function initialize() {
  initUIcomponents();
  initCore();
}

function initUIcomponents() {
  $UI.toolbar = new CaToolbar({
    id: 'ca_tools',
    zIndex: 601,
    hasMainTools: false,
    subTools: [
      // rectangle draw
      {
        icon: 'timeline',
        type: 'check',
        value: 'rect',
        title: 'Rectangle',
        callback: drawRectangle
      }
    ]
  });
}

// setting core functionality
function initCore() {
  // start initial
  const opt = {
    hasZoomControl: true,
    hasDrawLayer: true,
    hasLayerManager: true,
    hasScalebar: true,
    hasMeasurementTool: true
  };
  // set states if exist
  if ($D.params.states) {
    opt.states = $D.params.states;
  }
  try {
    $CAMIC = new CaMic("main_viewer", $D.params.slideId, opt);
  } catch (error) {
    Loading.close();
    $UI.message.addError('Core Initialization Failed');
    console.error(error);
    return;
  }
  $CAMIC.loadImg(function (e) {
    // image loaded
    if (e.hasError) {
      $UI.message.addError(e.message)
    }
  });

  $CAMIC.viewer.addOnceHandler('open', function (e) {
    // add stop draw function
    $CAMIC.viewer.canvasDrawInstance.addHandler('stop-drawing', camicStopDraw);

    // let m = document.getElementById('main_viewer');
    // m.addEventListener('mousedown', function (e) {
    //   getClickPosition(e, m);
    // });

  });
}

function redirect(url, text = '', sec = 5) {
  let timer = sec;
  setInterval(function () {
    if (!timer) {
      window.location.href = url;
    }

    if (Loading.instance.parentNode) {
      Loading.text.textContent = `${text} ${timer}s.`;
    } else {
      Loading.open(document.body, `${text} ${timer}s.`);
    }
    // Hint Message for clients that page is going to redirect to Flex table in 5s
    timer--;

  }, 1000);
}