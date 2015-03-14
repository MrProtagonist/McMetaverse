
var PlayerSkin = (function() {

    var console = {
        assert: function(){},
        log: function(){},
        warn: function(){},
        error: function(){},
        debug: function(){},
        dir: function(){},
        info: function(){}
    };

    if (window.console !== undefined)
        console = window.console;

    window.requestAnimFrame = (function(){
        return  window.requestAnimationFrame       ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                window.oRequestAnimationFrame      ||
                window.msRequestAnimationFrame     ||
                function(callback, element){
                    window.setTimeout(callback, 1000 / 60);
                };
	})();

    var simpleImageSrc = false;
    var scale = 10;
    var mode = 'best';  // or 'simple', or '2d', or '3d'

    // 3D objects
    var camera;
    var scene;
    var headGroup;
    var leftArmMesh;
    var rightArmMesh;
    var leftLegMesh;
    var rightLegMesh;
    var playerGroup;

    // 3D state
    var renderer;
    var mouseX = 0;
    var mouseY = 0.1;
    var originMouseX = 0;
    var originMouseY = 0;
    var isMouseOver = false;
    var isMouseDown = false;
    var isPaused = false;
    var rad = 0;
    var canvasWidth;
    var canvasHeight;
    var startTime = Date.now();
    var pausedTime;

    var skin = new Image();
    skin.crossOrigin = '';
    skin.onload = function() {
        if (mode === 'simple')
            renderSimple();
        else if (mode === '2d')
            render2D();
        else if (mode === '3d')
            render3D();
        else if (Modernizr.canvas)
            render3D();
        else
            renderSimple();
    };
    skin.onerror = function() {
        console.error('The skin image \'' + skin.src + '\' could not be loaded');
    };

    var renderSimple = function() {
        console.info('rendering simple ' + simpleImageSrc);
        showElement(skin);
    };

    var render2D = function() {
        console.info('rendering 2D ' + skin.src);
		var canvas = document.createElement('canvas');
		var context = canvas.getContext("2d");
		canvas.width = 16 * scale;
		canvas.height = 32 * scale;
		context.drawImage(skin, 8,  8,  8, 8,  4*scale,  0*scale,  8*scale, 8*scale);   // head
		context.drawImage(skin, 20, 20, 8, 12, 4*scale,  8*scale,  8*scale, 12*scale);  // body
		context.drawImage(skin, 4,  20, 4, 12, 4*scale,  20*scale, 4*scale, 12*scale);  // left leg
		context.drawImage(skin, 4,  20, 4, 12, 8*scale,  20*scale, 4*scale, 12*scale);  // right leg
		context.drawImage(skin, 44, 20, 4, 12, 0*scale,  8*scale,  4*scale, 12*scale);  // left arm
		context.drawImage(skin, 52, 20, 4, 12, 12*scale, 8*scale,  4*scale, 12*scale);  // right arm
        showElement(canvas);
    };

    var render3D = function() {
        console.info('rendering 3D ' + skin.src);

        canvasWidth = 21 * scale;
        canvasHeight = 35 * scale;

        var tileUvWidth = 1/64;
        var tileUvHeight = 1/32;

        var getMaterial = function(img, trans) {
            var material = new THREE.MeshBasicMaterial({
                map: new THREE.Texture(
                    img,
                    new THREE.UVMapping(),
                    THREE.ClampToEdgeWrapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.NearestFilter,
                    THREE.NearestFilter,
                    (trans ? THREE.RGBAFormat : THREE.RGBFormat)
                ),
                transparent: trans
            });
            material.map.needsUpdate = true;
            return material;
        };

        var uvmap = function(mesh, face, x, y, w, h, rotateBy) {
            if (! rotateBy) rotateBy = 0;
            var uvs = mesh.geometry.faceVertexUvs[0][face];
            var tileU = x;
            var tileV = y;
            uvs[ (0 + rotateBy) % 4 ].u = tileU * tileUvWidth;
            uvs[ (0 + rotateBy) % 4 ].v = tileV * tileUvHeight;
            uvs[ (1 + rotateBy) % 4 ].u = tileU * tileUvWidth;
            uvs[ (1 + rotateBy) % 4 ].v = tileV * tileUvHeight + h * tileUvHeight;
            uvs[ (2 + rotateBy) % 4 ].u = tileU * tileUvWidth + w * tileUvWidth;
            uvs[ (2 + rotateBy) % 4 ].v = tileV * tileUvHeight + h * tileUvHeight;
            uvs[ (3 + rotateBy) % 4 ].u = tileU * tileUvWidth + w * tileUvWidth;
            uvs[ (3 + rotateBy) % 4 ].v = tileV * tileUvHeight;
        };

        var cubeFromPlanes = function(size, mat) {
            var cube = new THREE.Object3D();
            var meshes = [];
            for (var i = 0; i < 6; i++) {
                var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
                mesh.doubleSided = true;
                cube.add(mesh);
                meshes.push(mesh);
            }
            // Front
            meshes[0].rotation.x = Math.PI/2;
            meshes[0].rotation.z = -Math.PI/2;
            meshes[0].position.x = size/2;
            // Back
            meshes[1].rotation.x = Math.PI/2;
            meshes[1].rotation.z = Math.PI/2;
            meshes[1].position.x = -size/2;
            // Top
            meshes[2].position.y = size/2;
            // Bottom
            meshes[3].rotation.y = Math.PI;
            meshes[3].rotation.z = Math.PI;
            meshes[3].position.y = -size/2;
            // Left
            meshes[4].rotation.x = Math.PI/2;
            meshes[4].position.z = size/2;
            // Right
            meshes[5].rotation.x = -Math.PI/2;
            meshes[5].rotation.y = Math.PI;
            meshes[5].position.z = -size/2;
            return cube;
        };

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = 64 * scale;
        canvas.height = 32 * scale;
//        context.mozImageSmoothingEnabled = false;     // doesn't work?

        var skinCanvas = document.createElement('canvas');
        var skinContext = skinCanvas.getContext('2d');
        skinCanvas.width = 64;
        skinCanvas.height = 32;
//        skinContext.mozImageSmoothingEnabled = false;     // doesn't work?

        var charMaterial = getMaterial(skinCanvas, false);
        //var charMaterialTrans = getMaterial(skinCanvas, true);

        camera = new THREE.PerspectiveCamera(35, canvasWidth / canvasHeight, 1, 1000);
        camera.position.z = 50;
        scene = new THREE.Scene();
        scene.add(camera);

        headGroup = new THREE.Object3D();

        //Head
        var headGeo = new THREE.CubeGeometry(8, 8, 8);
        var headMesh = new THREE.Mesh(headGeo, charMaterial);
        headMesh.position.y = 2;
        uvmap(headMesh, 0, 8, 8, 8, 8);
        uvmap(headMesh, 1, 24, 8, 8, 8);
        uvmap(headMesh, 2, 8, 0, 8, 8, 1);
        uvmap(headMesh, 3, 16, 0, 8, 8, 3);
        uvmap(headMesh, 4, 0, 8, 8, 8);
        uvmap(headMesh, 5, 16, 8, 8, 8);
        headGroup.add(headMesh);

        /*
        var helmet = cubeFromPlanes(9, charMaterialTrans);
        helmet.position.y = 2;
        uvmap(helmet.children[0], 0, 32+8, 8, 8, 8);
        uvmap(helmet.children[1], 0, 32+24, 8, 8, 8);
        uvmap(helmet.children[2], 0, 32+8, 0, 8, 8, 1);
        uvmap(helmet.children[3], 0, 32+16, 0, 8, 8, 3);
        uvmap(helmet.children[4], 0, 32+0, 8, 8, 8);
        uvmap(helmet.children[5], 0, 32+16, 8, 8, 8);
        headGroup.add(helmet);
        */

        headGroup.position.y = 8;

        var bodyGroup = new THREE.Object3D();

        // Body
        var bodyGeo = new THREE.CubeGeometry(4, 12, 8);
        var bodyMesh = new THREE.Mesh(bodyGeo, charMaterial);
        uvmap(bodyMesh, 0, 20, 20, 8, 12);
        uvmap(bodyMesh, 1, 32, 20, 8, 12);
        uvmap(bodyMesh, 2, 20, 16, 8, 4, 1);
        uvmap(bodyMesh, 3, 28, 16, 8, 4, 3);
        uvmap(bodyMesh, 4, 16, 20, 4, 12);
        uvmap(bodyMesh, 5, 28, 20, 4, 12);
        bodyGroup.add(bodyMesh);

        // Left arm
        var leftArmGeo = new THREE.CubeGeometry(4, 12, 4);
        for (var i = 0; i < 8; i+=1)
            leftArmGeo.vertices[i].y -= 4;
        leftArmMesh = new THREE.Mesh(leftArmGeo, charMaterial);
        leftArmMesh.position.z = -6;
        leftArmMesh.position.y = 4;
        leftArmMesh.rotation.x = Math.PI/32;
        uvmap(leftArmMesh, 0, 48, 20, -4, 12);
        uvmap(leftArmMesh, 1, 56, 20, -4, 12);
        uvmap(leftArmMesh, 2, 48, 16, -4, 4, 1);
        uvmap(leftArmMesh, 3, 52, 16, -4, 4, 3);
        uvmap(leftArmMesh, 4, 52, 20, -4, 12);
        uvmap(leftArmMesh, 5, 44, 20, -4, 12);
        bodyGroup.add(leftArmMesh);

        // Right arm
        var rightArmGeo = new THREE.CubeGeometry(4, 12, 4);
        for (var i = 0; i < 8; i += 1)
            rightArmGeo.vertices[i].y -= 4;
        rightArmMesh = new THREE.Mesh(rightArmGeo, charMaterial);
        rightArmMesh.position.z = 6;
        rightArmMesh.position.y = 4;
        rightArmMesh.rotation.x = -Math.PI/32;
        uvmap(rightArmMesh, 0, 44, 20, 4, 12);
        uvmap(rightArmMesh, 1, 52, 20, 4, 12);
        uvmap(rightArmMesh, 2, 44, 16, 4, 4, 1);
        uvmap(rightArmMesh, 3, 48, 16, 4, 4, 3);
        uvmap(rightArmMesh, 4, 40, 20, 4, 12);
        uvmap(rightArmMesh, 5, 48, 20, 4, 12);
        bodyGroup.add(rightArmMesh);

        // Left leg
        var leftLegGeo = new THREE.CubeGeometry(4, 12, 4);
        for (var i = 0; i < 8; i += 1)
            leftLegGeo.vertices[i].y -= 6;
        leftLegMesh = new THREE.Mesh(leftLegGeo, charMaterial);
        leftLegMesh.position.z = -2;
        leftLegMesh.position.y = -6;
        uvmap(leftLegMesh, 0, 8, 20, -4, 12);
        uvmap(leftLegMesh, 1, 16, 20, -4, 12);
        uvmap(leftLegMesh, 2, 4, 16, 4, 4, 3);
        uvmap(leftLegMesh, 3, 8, 20, 4, -4, 1);
        uvmap(leftLegMesh, 4, 12, 20, -4, 12);
        uvmap(leftLegMesh, 5, 4, 20, -4, 12);

        // Right leg
        var rightLegGeo = new THREE.CubeGeometry(4, 12, 4);
        for(var i = 0; i < 8; i += 1)
            rightLegGeo.vertices[i].y -= 6;
        rightLegMesh = new THREE.Mesh(rightLegGeo, charMaterial);
        rightLegMesh.position.z = 2;
        rightLegMesh.position.y = -6;
        uvmap(rightLegMesh, 0, 4, 20, 4, 12);
        uvmap(rightLegMesh, 1, 12, 20, 4, 12);
        uvmap(rightLegMesh, 2, 8, 16, -4, 4, 3);
        uvmap(rightLegMesh, 3, 12, 20, -4, -4, 1);
        uvmap(rightLegMesh, 4, 0, 20, 4, 12);
        uvmap(rightLegMesh, 5, 8, 20, 4, 12);

        var playerModel = new THREE.Object3D();
        playerModel.add(headGroup);
        playerModel.add(bodyGroup);
        playerModel.add(leftLegMesh);
        playerModel.add(rightLegMesh);
        playerModel.position.y = 6;

        playerGroup = new THREE.Object3D();
        playerGroup.add(playerModel);

        scene.add(playerGroup);

        if (Modernizr.webgl)
            renderer = new THREE.WebGLRenderer({antialias: true});
        else
            renderer = new THREE.CanvasRenderer({antialias: true});

        var threeCanvas = renderer.domElement;
        renderer.setSize(canvasWidth, canvasHeight);
        //renderer.setClearColorHex(0x000000, 0.25);
        showElement(threeCanvas);

        render3DFrame();

	skinContext.clearRect(0, 0, 64, 32);
        skinContext.drawImage(skin, 0, 0);
        // skinContext.mozImageSmoothingEnabled = false;    // doesn't work?

        /*
		var imgData = skinContext.getImageData(0, 0, 64, 32);
		var pixels = imgData.data;

		context.clearRect(0, 0, canvas.width, canvas.height);
		context.save();

		var isOnecolor = true;

		var colorCheckAgainst = [40, 0];
		var colorIndex = (colorCheckAgainst[0]+colorCheckAgainst[1]*64)*4;

		var isPixelDifferent = function (x, y) {
			return ((pixels[(x+y*64)*4+0] !== pixels[colorIndex+0]) ||
                    (pixels[(x+y*64)*4+1] !== pixels[colorIndex+1]) ||
                    (pixels[(x+y*64)*4+2] !== pixels[colorIndex+2]) ||
                    (pixels[(x+y*64)*4+3] !== pixels[colorIndex+3]));
		};

		// Check if helmet/hat is a solid color
		// Bottom row
		for (var i = 32; i < 64; i++) {
			for (var j = 8; j < 16; j++) {
				if (isPixelDifferent(i, j)) {
					isOnecolor = false;
					break;
				}
			}
			if (! isOnecolor) break;
		}
		if (! isOnecolor) {
			// Top row
			for (var i = 40; i < 56; i++) {
				for (var j = 0; j < 8; j++) {
					if (isPixelDifferent(i, j)) {
						isOnecolor = false;
						break;
					}
				}
				if (! isOnecolor) break;
			}
		}

		for (var i = 0; i < 64; i++) {
			for (var j = 0; j < 32; j++) {
				if (isOnecolor &&
                    (
                        ((i >= 32) && (i < 64) && (j >= 8) && (j < 16)) ||
                        ((i >= 40) && (i < 56) && (j >= 0) && (j < 8))
                    )) {
					pixels[(i + j * 64) * 4 + 3] = 0;
				}
				context.fillStyle =
                    'rgba(' + pixels[(i + j * 64) * 4 + 0] + ', ' + pixels[(i + j * 64) * 4 + 1] + ', ' + pixels[(i + j * 64) * 4 + 2] + ', ' + pixels[(i + j * 64) * 4 + 3] / 255 + ')';
				context.fillRect(i * scale, j * scale, scale, scale);
			}
		}
		context.restore();
        */


	charMaterial.map.needsUpdate = true;
	//charMaterialTrans.map.needsUpdate = true;

        var onMouseMove = function(e) {
            if (isMouseDown) {
                mouseX = (e.pageX - threeCanvas.offsetLeft - originMouseX);
                mouseY = (e.pageY - threeCanvas.offsetTop - originMouseY);
            }
        };

        threeCanvas.addEventListener('mousedown', function(e) {
            e.preventDefault();
            originMouseX = (e.pageX - threeCanvas.offsetLeft) - rad;
            originMouseY = (e.pageY - threeCanvas.offsetTop) - mouseY;
            isMouseDown = true;
            isMouseOver = true;
            isPaused = true;
            pausedTime = Date.now() - startTime;
            onMouseMove(e);
        }, false);
        threeCanvas.addEventListener('mouseout', function (e) {
            isMouseOver = false;
        }, false);
        window.addEventListener('mouseup', function (e) {
            isMouseDown = false;
            if (isPaused) {
                isPaused = false;
                startTime = Date.now() - pausedTime;
            }
        }, false);
        window.addEventListener('mousemove', onMouseMove, false);

        console.info("done");
    };

    var render3DFrame = function () {
        requestAnimationFrame(render3DFrame, renderer.domElement);

        var oldRad = rad;
        var time = (Date.now() - startTime) / 1000;

        if (isPaused)
            rad = mouseX;
        else
            rad += 0.5;
        if (mouseY > 500)
            mouseY = 500;
        else if (mouseY < -500)
            mouseY = -500;
        camera.position.x = -Math.cos(rad / (canvasWidth / 2) + (Math.PI / 0.9));
        camera.position.z = -Math.sin(rad / (canvasWidth / 2) + (Math.PI / 0.9));
        camera.position.y = (mouseY / (canvasHeight / 2)) * 1.5 + 0.2;
        camera.position.setLength(60);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        if (! isPaused) {
            headGroup.rotation.y = Math.sin( time * 1.5) / 5;
            headGroup.rotation.z = Math.sin(time) / 6;
            leftArmMesh.rotation.z = -Math.sin(time * 3) / 2;
            leftArmMesh.rotation.x = (Math.cos(time * 3) + Math.PI / 2) / 30;
            rightArmMesh.rotation.z = Math.sin(time * 3) / 2;
            rightArmMesh.rotation.x = -(Math.cos(time * 3) + Math.PI / 2) / 30;
            leftLegMesh.rotation.z = Math.sin(time * 3) / 3;
            rightLegMesh.rotation.z = -Math.sin(time * 3) / 3;
            playerGroup.position.y = -4; // Not jumping
        }

        renderer.render(scene, camera);
    };

    var showElement = function(childEl) {
        var el = document.getElementById('skin');
        if (! el) {
            console.error('Skin element not found');
            return;
        }
        while (el.hasChildNodes())
            el.removeChild(el.firstChild);
        el.appendChild(childEl);
    };

    return {
        setSimpleImage: function(imgSrc) {
            simpleImageSrc = imgSrc;
        },
        setScale: function(s) {
            scale = s;
        },
        setRenderMode: function(m) {
            if (typeof(m) == 'string')
                mode = m.toLowerCase();
            else
                mode = m;
        },
        setSkin: function(playerName) {
            if (Modernizr.canvas)
                skin.src = '../skin/' + playerName;
            else
                skin.src = simpleImageSrc;
        }
    };

}());
