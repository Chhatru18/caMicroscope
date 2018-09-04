// Draw
// OpenSeadragon Draw plugin 0.0.1 based on canvas overlay plugin


// test
// 1. create canvasDraw twins, only one instance that keeps in the viewer
// 2. reset options style = opt.style drawOn/Off -> drawOff
// 3. getImagePaths -> image coordinates 
// 4. getViewportPaths -> viewport coordinates 
// 5. redo
// 6. undo
// 7. clear status
// 8. clear canvas
// 9. clearAll
// 10. change zoom -> undo -> redo == paths are correct
// 

(function($) {
    
    if (!$) {
        $ = require('openseadragon');
        if (!$) {
            throw new Error('OpenSeadragon is missing.');
        }
    }

    // check version
    if (!$.version || $.version.major < 2) {
        throw new Error('This version of OpenSeadragonScalebar requires ' +
                'OpenSeadragon version 2.2.0+');
    }
    // ----------
    $.Viewer.prototype.canvasDraw = function(options) {
        if (!this.canvasDrawInstance) {
            options = options || {};
            options.viewer = this;
            this.canvasDrawInstance = new $.CanvasDraw(options);
        } else {
            this.canvasDrawInstance.updateOptions(options);
        }
    };

    $.CanvasDraw = function(options) {

    	this._viewer = options.viewer;
        // flag
		// draw mode on/off
    	this.isOn = false;
    	// is drawing things
    	this.isDrawing = false;

    	// creat supplies free, square, rectangle
    	this.drawMode = options.drawMode || 'free'; // 'free', 'square', 'rect'
		// ctx styles opt
		this.style = {
			color:'#7CFC00',
			lineWidth:3,
			lineJoin:'round', // "bevel" || "round" || "miter"
			lineCap:'round' // "butt" || "round" || "square"
		};

		if(options.style && options.style.color) this.style.color = options.style.color;
		if(options.style && options.style.lineWidth) this.style.lineWidth = options.style.lineWidth;
		if(options.style && options.style.lineJoin) this.style.lineJoin = options.style.lineJoin;
		if(options.style && options.style.lineCap) this.style.lineCap = options.style.lineCap;
		
		// global events list for easily remove and add
		this._event = {
		  start:this.startDrawing.bind(this), 
		  stop:this.stopDrawing.bind(this),
		  drawing:this.drawing.bind(this),
		  updateView:this.updateView.bind(this)
		};

		// status data
		this._last = [0,0];
		this._current_path_ = {};
		this._draws_data_ = [];
		this._path_index = 0;


    	// -- create container div, and draw, display canvas -- // 
        this._containerWidth = 0;
        this._containerHeight = 0;

        // container div
        this._div = document.createElement( 'div');
        this._div.style.position = 'absolute';
        this._div.style.left = 0;
        this._div.style.top = 0;
        this._div.style.width = '100%';
        this._div.style.height = '100%';
        this._div.style.display = 'none';
        this._div.style.zIndex =  options.zIndex || 500;
        this._viewer.canvas.appendChild(this._div);
        // draw canvas
        this._draw_ = document.createElement('canvas');
        this._draw_.style.position = 'absolute';
        this._draw_.style.top = 0;
        this._draw_.style.left = 0;
        this._draw_ctx_ = this._draw_.getContext('2d');
        this._div.appendChild(this._draw_);
        
        // display vanvas
        this._display_ = document.createElement('canvas');
        this._display_.style.position = 'absolute';
        this._display_.style.top = 0;
        this._display_.style.left = 0;
        this._display_ctx_ = this._display_.getContext('2d');
        this._div.appendChild(this._display_);

        this.updateView();
       
    }
    // ----------
    $.CanvasDraw.prototype = {
    	updateView: function(){
    		this.resize();
    		this._updateCanvas();
    	},

    	updateOptions:function(options){
			// draw mode on/off
			this.isOn = false;
			// is drawing things
			this.isDrawing = false;

			// creat supplies free, square, rectangle
			this.drawMode = options.drawMode || 'rect'; // 'free', 'square', 'rect'
			// ctx styles opt
			this.style = {
				color:'#7CFC00',
				lineWidth:3,
				lineJoin:'round', // "bevel" || "round" || "miter"
				lineCap:'round' // "butt" || "round" || "square"
			};

			if(options.style && options.style.color) this.style.color = options.style.color;
			if(options.style && options.style.lineWidth) this.style.lineWidth = options.style.lineWidth;
			if(options.style && options.style.lineJoin) this.style.lineJoin = options.style.lineJoin;
			if(options.style && options.style.lineCap) this.style.lineCap = options.style.lineCap;

			this._div.style.display = 'none';
			this._div.style.zIndex =  options.zIndex || 500;
			this.clearStatus();
			this.clearCanvas();
			this.drawOff();

    	},
    	clearStatus:function(){
			this._last = [0,0];
			this._current_path_ = {};
			this._draws_data_ = [];
			this._path_index = 0;
    	},
		drawOnCanvas:function(ctx,drawFuc){
			var viewportZoom = this._viewer.viewport.getZoom(true);
			var image1 = this._viewer.world.getItemAt(0);
			var zoom = image1.viewportToImageZoom(viewportZoom);

			var x=((this._viewportOrigin.x/this.imgWidth-this._viewportOrigin.x )/this._viewportWidth)*this._containerWidth;
			var y=((this._viewportOrigin.y/this.imgHeight-this._viewportOrigin.y )/this._viewportHeight)*this._containerHeight;

			DrawHelper.clearCanvas(ctx.canvas);
			ctx.translate(x,y);
			ctx.scale(zoom,zoom);     
			//
			drawFuc();
			//
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		},


        clearCanvas: function() {
            DrawHelper.clearCanvas(this._display_);
            DrawHelper.clearCanvas(this._draw_);
        },


        resize: function() {
            if (this._containerWidth !== this._viewer.container.clientWidth) {
                this._containerWidth = this._viewer.container.clientWidth;
                this._div.setAttribute('width', this._containerWidth);
                this._draw_.setAttribute('width', this._containerWidth);
                this._display_.setAttribute('width', this._containerWidth);
            }

            if (this._containerHeight !== this._viewer.container.clientHeight) {
                this._containerHeight = this._viewer.container.clientHeight;
                this._div.setAttribute('height', this._containerHeight);
                this._draw_.setAttribute('height', this._containerHeight);
                this._display_.setAttribute('height', this._containerHeight);
            }
            this._viewportOrigin = new $.Point(0, 0);
            var boundsRect = this._viewer.viewport.getBounds(true);
            this._viewportOrigin.x = boundsRect.x;
            this._viewportOrigin.y = boundsRect.y * this.imgAspectRatio;
            
            this._viewportWidth = boundsRect.width;
            this._viewportHeight = boundsRect.height * this.imgAspectRatio;
            var image1 = this._viewer.world.getItemAt(0);
            this.imgWidth = image1.source.dimensions.x;
            this.imgHeight = image1.source.dimensions.y;
            this.imgAspectRatio = this.imgWidth / this.imgHeight;
        },

        _updateCanvas: function() {
            var viewportZoom = this._viewer.viewport.getZoom(true);
            var image1 = this._viewer.world.getItemAt(0);
            var zoom = image1.viewportToImageZoom(viewportZoom);
            
            var x=((this._viewportOrigin.x/this.imgWidth-this._viewportOrigin.x )/this._viewportWidth)*this._containerWidth;
            var y=((this._viewportOrigin.y/this.imgHeight-this._viewportOrigin.y )/this._viewportHeight)*this._containerHeight;
            
            this.clearCanvas();
            this._display_.getContext('2d').translate(x,y);
            this._display_.getContext('2d').scale(zoom,zoom);     
            DrawHelper.draw(this._display_ctx_,this._draws_data_.slice(0,this._path_index));
            this._display_.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
        },

		drawOn:function(){
			// stop turning on draw mode if already turn on
			if(this.isOn === true) return;
			// clock viewer
			//this._viewer.controls.bottomright.style.display = 'none';
			this.updateView();
			this._viewer.setMouseNavEnabled(false);
			this._div.style.cursor = 'pointer';
			this._div.style.display = 'block';

			// add Events
			this._div.addEventListener('mousemove', this._event.drawing);
			this._div.addEventListener('mouseout',this._event.stop);
			this._div.addEventListener('mouseup',this._event.stop);
			this._div.addEventListener('mousedown',this._event.start);

			this._viewer.addHandler('update-viewport',this._event.updateView);
			this._viewer.addHandler('open',this._event.updateView);
			//
			this.isOn = true;
			
			this._viewer.raiseEvent('canvas-draw-on',{draw:true});

		},

		drawOff:function(){
			// stop turning off draw mode if already turn off
			//if(this.contextMenu) this.contextMenu.
			if(this.isOn === false) return;
			// unclock viewer
			//this._viewer.controls.bottomright.style.display = '';
			this._viewer.setMouseNavEnabled(true);
			this._div.style.cursor = 'default';
			this._div.style.display = 'none';

			// remove Events
			this._div.removeEventListener('mousemove', this._event.drawing);
			this._div.removeEventListener('mouseout',this._event.stop);
			this._div.removeEventListener('mouseup',this._event.stop);
			this._div.removeEventListener('mousedown',this._event.start);

			this._viewer.removeHandler('update-viewport',this._event.updateView);
			this._viewer.removeHandler('open',this._event.updateView);

			this.isOn = false;
			
			this._viewer.raiseEvent('canvas-draw-off',{draw:false});
		},

		/*
		* Start drawing in a new geojson feature
		*/
		startDrawing:function(e){
			//prevent to open context menu when click on drawing mode
			let isRight;
			e = e || window.event;
			if ("which" in e)  // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
			    isRight = e.which == 3; 
			else if ("button" in e)  // IE, Opera 
			    isRight = e.button == 2; 
			if(e.ctrlKey || isRight) return;

			// close style context menu if it open
			if(this.contextMenu)this.contextMenu.close(e);
			let point = new OpenSeadragon.Point(e.clientX, e.clientY);
			let img_point = this._viewer.viewport.windowToImageCoordinates(point);

			if(0 > img_point.x || this.imgWidth < img_point.x || 0 > img_point.y || this.imgHeight < img_point.y )return;
			// start drawing
			this.isDrawing = true;
			this._draw_.style.cursor = 'crosshair'
			
			
			this._last = [img_point.x,img_point.y]
			// first feature within
			this.__newFeature(this._last.slice());
		},

		drawing(e){
			if(!this.isDrawing || !this.isOn) return;
			// drawing
			let point = new OpenSeadragon.Point(e.clientX, e.clientY);
			let img_point = this._viewer.viewport.windowToImageCoordinates(point);
			if(0 > img_point.x || this.imgWidth < img_point.x || 0 > img_point.y || this.imgHeight < img_point.y )return;
			
			//set style for ctx
			DrawHelper.setStyle(this._draw_ctx_,this.style);
			this._draw_ctx_.fillStyle = hexToRgbA(this.style.color,0.3);
			switch (this.drawMode) {
			  case 'free':
			    // draw line
			    this._last = [img_point.x,img_point.y];
			    // store current point
			    this._current_path_.geometry.coordinates[0].push(this._last.slice());
			    this.drawOnCanvas(this._draw_ctx_,function(){
			    	DrawHelper.drawMultiline(this._draw_ctx_,this._current_path_.geometry.coordinates[0]);
			    }.bind(this));
			    break;

			  case 'square':
			    // draw square
			    DrawHelper.clearCanvas(this._draw_);
			    this.drawOnCanvas(this._draw_ctx_,function(){
			    	const item = DrawHelper.drawRectangle(this._draw_ctx_,this._last,[img_point.x,img_point.y],true);
			    	this._current_path_.geometry.path = item.path;
			    	this._current_path_.geometry.coordinates[0] = item.points;
			    }.bind(this));
			    break;
			  case 'rect':
			    // draw rectangle
			    DrawHelper.clearCanvas(this._draw_);
			    this.drawOnCanvas(this._draw_ctx_,function(){
			    	const item = DrawHelper.drawRectangle(this._draw_ctx_,this._last,[img_point.x,img_point.y]);
			    	this._current_path_.geometry.path = item.path;
			    	this._current_path_.geometry.coordinates[0] = item.points;
			    }.bind(this));
			    break;
			  default:
			    // statements_def
			    break;
			}
		},
		/*
		* stop drawing
		@ @returns data - the geojson assotiated with the drawing
		*/
		stopDrawing:function(e){
			if(this.isDrawing) {
			  // add style and data to data collection
			  this.__endNewFeature();
			}
			// this is the geometry data, in points; conv to geojson
			this.isDrawing = false;
			this._draw_.style.cursor = 'pointer';

		},
		getImageFeatureCollection() { //Image [for draw on image] // Viewport
			const rs = {
				type:'FeatureCollection',
				features:[]
			};
			// for (var i = 0; i < this._path_index; i++) {
			// 	const featrue = this._draws_data_[i].feature;
			rs.features = this._draws_data_.slice(0,this._path_index);
			// }
			return rs;
		},
		// getViewportFeatureCollection() { //Image [for draw on image] // Viewport
		// 	const rs = this.getImageFeatureCollection();
		// 	rs.geometries.features = rs.geometries.features.map(feature =>{
		// 		feature.geometry.coordinates[0] = feature.geometry.coordinates[0].map(point => {
		// 			v_point = this._viewer.viewport.imageToViewportCoordinates(point[0],point[1]);
		// 			return [v_point.x,v_point.y];
		// 		},this)
		// 		return feature;
		// 	},this);
		// 	return rs;
		// },
		/*
		* adds the point to the current feature
		@ @param x - x position in logical coords
		@ @param y - y position in logical coords
		*/
		// __extendFeature:function(x,y){
		// 	this._current_path_.feature.geometry.coordinates[0].add({x:x,y:y});
		// },
		/*
		* creates a new feature in the geojson coordinate list
		*/
		__newFeature:function(point){
			this._current_path_={
				type:'Feature',
				properties:{
					style:{}
				},
				geometry:{
					type:"Polygon",
					coordinates:[[point]],
					path:null
				}
			};
		},
		__isOnlyTwoSamePoints:function(points){
			if(points.length == 2 && points[0].x == points[1].x && points[0].y == points[1].y){
			  return true;
			}
			return false;
		},
		__endNewFeature:function(){
			if(this._current_path_.geometry.coordinates[0].length < 2 || this.__isOnlyTwoSamePoints(this._current_path_.geometry.coordinates[0])  ) return; // click on canvas
			// set style and drawing model
			this._current_path_.properties.style.color = this.style.color;
			this._current_path_.properties.style.lineJoin = this.style.lineJoin;
			this._current_path_.properties.style.lineCap = this.style.lineCap;
			this._current_path_.properties.style.lineWidth = this.style.lineWidth;
			let points = this._current_path_.geometry.coordinates[0];
			points.push([points[0][0],points[0][1]]);

			if(this.drawMode === 'free') {
			  // simplify
			  this._current_path_.geometry.coordinates[0] = simplify(points);
			};

			// 
			if(this._path_index < this._draws_data_.length){
			  this._draws_data_ = this._draws_data_.slice(0,this._path_index);
			}

			this._draws_data_.push(Object.assign({},this._current_path_));
			this._path_index++;
			this._current_path_ = null;
			DrawHelper.clearCanvas(this._draw_);


			this.drawOnCanvas(this._display_ctx_,function(){
				DrawHelper.draw(this._display_ctx_,this._draws_data_.slice(0,this._path_index));
			}.bind(this));
		},

		undo:function(){
			if(this._path_index > 0)
				// redraw path
				this.drawOnCanvas(this._display_ctx_,function(){
					DrawHelper.draw(this._display_ctx_,this._draws_data_.slice(0,--this._path_index));
				}.bind(this));

		},
		redo:function(){
			if(this._draws_data_.length > this._path_index)
				// redraw path
				this.drawOnCanvas(this._display_ctx_,function(){
					DrawHelper.draw(this._display_ctx_,this._draws_data_.slice(0,++this._path_index));
				}.bind(this));
		},
		clear:function(){
			this.clearStatus();
			this.clearCanvas();
		}
    };

})(OpenSeadragon);