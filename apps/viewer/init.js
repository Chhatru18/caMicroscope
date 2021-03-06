// CAMIC is an instance of camicroscope core
// $CAMIC in there
let $CAMIC = null;
// for all instances of UI components
const $UI = new Map();

const $D = {
  pages:{
    home:'../table.html',
    table:'../table.html'
  },
  params:null, // parameter from url - slide Id and status in it (object).
  overlayers:null, // array for each layers
  templates:null // json schema for prue-form
};

window.addEventListener('keydown', (e) => {
  if(!$CAMIC || !$CAMIC.viewer) return;
  const keyCode = e.keyCode;
  // escape key to close all operations
  if(keyCode==27){
    magnifierOff();
    measurementOff();
    annotationOff();
  }

  // open annotation (ctrl + a)
  if(e.ctrlKey && keyCode == 65 && $CAMIC.viewer.canvasDrawInstance){
    const li = $UI.toolbar.getSubTool('annotation');
    eventFire(li,'click');
    return;
  }
  // open magnifier (ctrl + m)
  if(e.ctrlKey && keyCode == 77 && $UI.spyglass){
    const li = $UI.toolbar.getSubTool('magnifier');
    const chk = li.querySelector('input[type=checkbox]');
    chk.checked = !chk.checked;
    eventFire(chk,'change');
    return;
  }
  // open measurement (ctrl + r)
  if(e.ctrlKey && keyCode == 82 && $CAMIC.viewer.measureInstance){
    const li = $UI.toolbar.getSubTool('measurement');
    const chk = li.querySelector('input[type=checkbox]');
    chk.checked = !chk.checked;
    eventFire(chk,'click');
    return;
  }

});

// initialize viewer page
function initialize(){
      var checkPackageIsReady = setInterval(function () {
        if(IsPackageLoading) {
          clearInterval(checkPackageIsReady);
          // create a viewer and set up
          initCore();

          // loading the form template data
          FormTempaltesLoader();

          // loading the overlayers data
          OverlayersLoader();
        }
      }, 100);
}

// setting core functionalities
function initCore(){
  // start initial
  // TODO zoom info and mmp
  const opt = {
    draw:{
      // extend context menu btn group
      btns:[
        { // annotation
          type:'btn',
          title:'Annotation',
          class:'material-icons',
          text:'description',
          callback:saveAnnotation
        },
        { // analytics
          type:'btn',
          title:'Analytics',
          class:'material-icons',
          text:'settings_backup_restore',
          callback:saveAnalytics
        }
      ]
    }
  }
  // set states if exist
  if($D.params.states){
    opt.states = $D.params.states;
  }

  try{
    let slideQuery = {}
    slideQuery.id = $D.params.slideId
    slideQuery.name = $D.params.slide
    slideQuery.location = $D.params.location
    $CAMIC = new CaMic("main_viewer", slideQuery, opt);
  }catch(error){
    Loading.close();
    $UI.message.addError('Core Initialization Failed');
    console.error(error);
    return;
  }

  $CAMIC.loadImg(function(e){
    // image loaded
    if(e.hasError){
      $UI.message.addError(e.message)
      // can't reach Slide and return to home page
      if(e.isServiceError) redirect($D.pages.table,e.message, 0);
    }else{
      $D.params.data = e;
      // popup panel
      $CAMIC.viewer.addHandler('canvas-lay-click',function(e){
        if(!e.data) {
          $UI.annotPopup.close();
          return;
        }
        // for support QUIP 2.0
        const data = Array.isArray(e.data)? e.data[e.data.selected]: e.data;

        const type = data.provenance.analysis.source;
        let body;
        let attributes;
        let warning = null;
        switch (type) {
          case "human":
            let area;
            let circumference;
            if((data.selected!=null || data.selected!=undefined) && data.geometries.features[data.selected] &&data.geometries.features[data.selected].properties.area)
              area = `${Math.round(data.geometries.features[data.selected].properties.area)}μm^2`;
            if((data.selected!=null || data.selected!=undefined) && data.geometries.features[data.selected] &&data.geometries.features[data.selected].properties.circumference)
              circumference = `${Math.round(data.geometries.features[data.selected].properties.circumference)}μm`;
            // human
            
            attributes = data.properties.annotations;
            if(area) attributes.area = area;
            if(circumference) attributes.circumference = circumference;
            body = convertHumanAnnotationToPopupBody(attributes);
            if(data.geometries.features[data.selected].properties.isIntersect){
              warning = `<div style='color:red;text-align: center;font-size:12px;'>Inaccurate Area and Circumference</div>`;
            }
            if(data.geometries.features[data.selected].properties.nommp){
              warning = `<div style='color:red;text-align: center;font-size:12px;'>This slide has no mpp</div>`;
            }

            $UI.annotPopup.showFooter();
            break;
          case "computer":
            // handle data.provenance.analysis.computation = `segmentation`
            attributes = data.properties.scalar_features[0].nv;
            body = {type:'map',data:attributes};
            $UI.annotPopup.hideFooter();
            break;
          default:
            return;
            // statements_def
            break;
        }
        $UI.annotPopup.data = {
          id:data.provenance.analysis.execution_id,
          oid:data._id.$oid,
          annotation:attributes,
          selected:e.data.selected,
        };
        $UI.annotPopup.setTitle(`id:${data.provenance.analysis.execution_id}`);
        $UI.annotPopup.setBody(body);
        if(warning)$UI.annotPopup.body.innerHTML += warning;

        $UI.annotPopup.open(e.position);
      });

      // create the message bar TODO for reading slide Info TODO
      $UI.slideInfos = new CaMessage({
      /* opts that need to think of*/
        id:'cames',
        defaultText:`Slide: ${$D.params.data.name}`
      });

      // spyglass
      $UI.spyglass = new Spyglass({
        targetViewer:$CAMIC.viewer,
        imgsrc:$D.params.data.url
      });
    }
  });

  $CAMIC.viewer.addHandler('open',function(){
    $CAMIC.viewer.canvasDrawInstance.addHandler('start-drawing',startDrawing);
    $CAMIC.viewer.canvasDrawInstance.addHandler('stop-drawing',stopDrawing);
    // init UI -- some of them need to wait data loader to load data
    // because UI components need data to initialize
    initUIcomponents();
  });
}


// initialize all UI components
function initUIcomponents(){
  /* create UI components */
  // create the message queue
  $UI.message = new MessageQueue();

  $UI.modalbox = new ModalBox({
    id:'modalbox',
    hasHeader:true,
    headerText:'HeatMap List',
    hasFooter:false
  });

  const subToolsOpt = [];
  // home
  if( ImgloaderMode =='iip') subToolsOpt.push({
        name:'home',
        icon:'home', // material icons' name
        title:'Home',
        type:'btn', // btn/check/dropdown
        value:'home',
        callback:goHome
      });
  // pen
  subToolsOpt.push({
    name:'annotation',
    icon:'create',// material icons' name
    title:'Draw',
    type:'multistates',
    callback:draw
  });
  // magnifier
  subToolsOpt.push({
    name:'magnifier',
    icon:'search',
    title:'Magnifier',
    type:'dropdown',
    value:'magn',
    dropdownList:[
      {
        value:0.5,
        title:'0.5',
        checked:true
      },
      {
        value:1,
        title:'1.0'
      },
      {
        value:2,
        title:'2.0'
      }
    ],
    callback:toggleMagnifier
  });
  // measurement tool
  if($CAMIC.viewer.measureInstance) subToolsOpt.push({
    name:'measurement',
    icon:'space_bar',
    title:'Measurement',
    type:'check',
    value:'measure',
    callback:toggleMeasurement
  });
  // share
  if( ImgloaderMode =='iip') subToolsOpt.push({
    name:'share',
    icon:'share',
    title:'Share View',
    type:'btn',
    value:'share',
    callback:shareURL
  });
  // side-by-side
  subToolsOpt.push({
    name:'sbsviewer',
    icon:'view_carousel',
    title:'Side By Side Viewer',
    value:'dbviewers',
    type:'check',
    callback:toggleViewerMode
  });
  // heatmap
  subToolsOpt.push({
    name:'heatmap',
    icon:'satellite',
    title:'Heat Map',
    value:'heatmap',
    type:'btn',
    callback:openHeatmap
  });  
  // -- For Nano borb Start -- //
  if(ImgloaderMode =='imgbox'){
    // download
    subToolsOpt.push({
      name:'downloadmarks',
      icon:'cloud_download',
      title:'Download Marks',
      type:'btn',
      value:'download',
      callback:Store.prototype.DownloadMarksToFile
    });
    subToolsOpt.push({
      name:'uploadmarks',
      icon:'cloud_upload',
      title:'Load Marks',
      type:'btn',
      value:'upload',
      callback:Store.prototype.LoadMarksFromFile
    });
    // subToolsOpt.push({
    //   icon: 'timeline',
    //   type: 'check',
    //   value: 'rect',
    //   title: 'Segment',
    //   callback: function () {
    //     if(window.location.search.length > 0) {
    //       window.location.href = '../segment/segment.html' + window.location.search;
    //     }else{
    //       window.location.href = '../segment/segment.html';
    //     }
    //   }
    // });
  }
  // -- For Nano borb End -- //
  
  // bug report
  subToolsOpt.push({
    name:'bugs',
    icon: 'bug_report',
    title: 'Bug Report',
    value: 'bugs',
    type: 'btn',
    callback: ()=>{window.open('https://goo.gl/forms/mgyhx4ADH0UuEQJ53','_blank').focus()}
  });

  // create the tool bar
  $UI.toolbar = new CaToolbar({
  /* opts that need to think of*/
    id:'ca_tools',
    zIndex:601,
    mainToolsCallback:mainMenuChange,
    subTools:subToolsOpt
  });

  // create two side menus for tools
  $UI.appsSideMenu = new SideMenu({
    id:'side_apps',
    width: 300,
    //, isOpen:true
    callback:toggleSideMenu
  });

  $UI.layersSideMenu = new SideMenu({
    id:'side_layers',
    width: 300,
    contentPadding:5,
    //, isOpen:true
    callback:toggleSideMenu
  });

  /* annotation popup */
  $UI.annotPopup = new PopupPanel({
    footer:[
      // { // edit
      //   title:'Edit',
      //   class:'material-icons',
      //   text:'notes',
      //   callback:anno_edit
      // },
      { // delete
        title:'Delete',
        class:'material-icons',
        text:'delete_forever',
        callback:anno_delete
      }
    ]
  });

  var checkOverlaysDataReady = setInterval(function () {
    if($D.overlayers) {
      clearInterval(checkOverlaysDataReady);

      // create UI and set data
      $UI.layersViewer = new LayersViewer({id:'overlayers',data:$D.overlayers,sortChange:sort_change,callback:callback });

      callback($D.overlayers.filter(lay => lay.isShow));

      $UI.layersViewer.elt.parentNode.removeChild($UI.layersViewer.elt);

      // add to layers side menu
      const title = document.createElement('div');
      title.classList.add('item_head');
      title.textContent = 'Layers Manager';
      $UI.layersSideMenu.addContent(title);
      $UI.layersSideMenu.addContent($UI.layersViewer.elt);
    }
  }, 500);






  var checkTemplateSchemasDataReady = setInterval(function () {
    if($D.templates) {
      clearInterval(checkTemplateSchemasDataReady);
      const annotRegex = new RegExp('annotation', 'gi');
      const annotSchemas = $D.templates.filter(item=> item.id.match(annotRegex));
      /* annotation control */
      $UI.annotOptPanel = new OperationPanel({
        //id:
        //element:
        formSchemas:annotSchemas,
        resetCallback:reset_callback,
        action:{
          title:'Save',
          callback:anno_callback,
        }
      });
      // START QUIP550 TEMPORARILY REMOVE Algorithm Panel //
      // add to layers side menu
      const title = document.createElement('div');
      title.classList.add('item_head');
      title.textContent = 'Annotation';
      $UI.appsSideMenu.addContent(title);
      $UI.annotOptPanel.elt.classList.add('item_body');
      $UI.appsSideMenu.addContent($UI.annotOptPanel.elt);
      
      //$UI.appsList.clearContent('annotation');
      //$UI.appsList.addContent('annotation',$UI.annotOptPanel.elt);
      /* algorithm control */
      // const algoRegex = new RegExp('algo', 'gi');
      // const algoSchemas = $D.templates.filter(item => item.id.match(algoRegex));
      // $UI.algOptPanel = new OperationPanel({
      //   //id:
      //   //element:
      //   title:'Algorithm:',
      //   formSchemas:algoSchemas,
      //   action:{
      //     title:'Run',
      //     callback:algo_callback
      //   }
      // });
      // $UI.appsList.clearContent('analytics');
      // $UI.appsList.addContent('analytics',$UI.algOptPanel.elt);
      // $UI.appsList.addContent('analytics', AnalyticsPanelContent);
      // END QUIP550 TEMPORARILY REMOVE Algorithm Panel //

    }
  }, 500);


  // START QUIP550 //
  //   // collapsible list
  // $UI.appsList = new CollapsibleList({
  //   id:'collapsiblelist',
  //   list:[
  //     {
  //       id:'annotation',
  //       title:'Annotation',
  //       icon:'border_color',
  //       content: "No Template Loaded" //$UI.annotOptPanel.elt
  //       // isExpand:true

  //     }
  //     ,{
  //       id:'analytics',
  //       icon:'find_replace',
  //       title:'Analytics',
  //       content:"No Template Loaded" //$UI.algOptPanel.elt,
  //     }
  //   ],
  //   changeCallBack:getCurrentItem
  // });


  // // detach collapsible_list
  // $UI.appsList.elt.parentNode.removeChild($UI.appsList.elt);
  // $UI.appsSideMenu.addContent($UI.appsList.elt);
  // END QUIP550 //
  $UI.multSelector = new MultSelector({id:'mult_selector'});
  $UI.multSelector.addHandler('cancel',multSelector_cancel);
  $UI.multSelector.addHandler('action',multSelector_action);
}

function redirect(url ,text = '', sec = 5){
  let timer = sec;
  setInterval(function(){
    if(!timer) {
      window.location.href = url;
    }

    if(Loading.instance&&Loading.instance.parentNode){
      Loading.text.textContent = `${text} ${timer}s.`;
    }else{
      Loading.open(document.body,`${text} ${timer}s.`);
    }
    // Hint Message for clients that page is going to redirect to Flex table in 5s
    timer--;

  }, 1000);
}
