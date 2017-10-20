/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
var INPUT_TRIANGLES_URL = "https://jdeng8.github.io/prog2/triangles.json"; // triangles file loc
var INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc

var selectTri = -1;
var selectEll = -1;
var triNum = 0;
var ellNum = 0;

var blinn = true;

var Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var at = new vec3.fromValues(0,0,1);
var viewUp = new vec4.fromValues(0,1,0);
var lookAt = vec3.fromValues(0.5,0.5,0.5);

var selectN = 0;
var selectA = 0;
var selectD = 0;
var selectS = 0;

var tranX =0;
var tranY =0;
var tranZ =0;

var rotMatrix = mat4.create();
var viewMatrix = mat4.create();

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples

var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vtxBufferSize = 0; // the number of vertices in the vertex buffer

var vertexPositionAttrib; // where to put position for vertex 
var vertexColorAttrib; // where to put position for vertex shader

var coordArray = []; // 1D array of vertex coords for WebGL
var indexArray = []; // 1D array of vertex indices for WebGL

// ASSIGNMENT HELPER FUNCTIONS

//viewing and perspective transform
function transform(vtxs,eye){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    // var res = vec3.create();

    var matview = mat4.create();
    // var center = vec3.create();
    // center = vec3.add(center,eye,at);
    var center = lookAt;
    matview = mat4.lookAt(matview, eye, center, viewUp);

    var matPers = mat4.create();
    matPers = mat4.perspective(matPers, Math.PI/2., 1, 0.1, 10);

    // var resize = mat4.fromValues(2,0,0,0,0,2,0,0,0,0,2,0,-1,-1,-1,1);
    // var reflection = mat4.fromValues(-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);

    vec3.transformMat4(vtx, vtx, matview);
    vec3.transformMat4(vtx, vtx, matPers);
    // vec3.transformMat4(vtx, vtx, reflection);
    // vec3.transformMat4(vtx, vtx, resize);

    return vtx;
}

//hightlight selected object
function scale(vtxs, center, coe){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    vec3.subtract(vtx,vtx,center);
    vec3.scaleAndAdd(vtx,center,vtx,coe);
    return vtx;
}

//move object
function translate(vtxs,x,y,z){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    var tranM = mat4.fromValues(1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1);
    vec3.transformMat4(vtx, vtx, tranM);
    return vtx;
}

//rotate object or view
function rotate(vtxs,center,matrix){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    vec3.subtract(vtx,vtx,center);
    vec3.transformMat4(vtx, vtx, matrix);
    vec3.add(vtx,vtx,center);
    return vtx;
}

//compute color
function lighting(eye,light,normal,vertex,ka,kd,ks,n,b){
    var color = [
                    ka[0]*light[0].ambient[0],
                    ka[1]*light[0].ambient[1],
                    ka[2]*light[0].ambient[2]
                ];
    //add multiple light
    for(var lightIndex =0; lightIndex<light.length;lightIndex++){
        lightSource = light[lightIndex];
        var la = lightSource.ambient;
        var ld = lightSource.diffuse;
        var ls = lightSource.specular;

        var lightPos = vec3.fromValues(lightSource.x,lightSource.y,lightSource.z);

        var lvec = vec3.create();
        vec3.subtract(lvec,lightPos,vertex);
        vec3.normalize(lvec,lvec);

        var evec = vec3.create();
        vec3.subtract(evec,eye,vertex);
        vec3.normalize(evec,evec);

        var hvec = vec3.create();
        vec3.add(hvec,evec,lvec);
        vec3.normalize(hvec,hvec);


        var nh = vec3.create();
        var nl = Math.max(vec3.dot(normal,lvec),0);

        var ref = vec3.create();
        vec3.scale(ref,normal,2*vec3.dot(lvec,normal));
        vec3.subtract(ref,ref,lvec);

        if(b) nh = Math.max(vec3.dot(normal,hvec),0);
        else nh = Math.max(vec3.dot(evec,ref),0)

        color[0] += kd[0]*ld[0]*nl+ks[0]*ls[0]*Math.pow(nh,n);
        color[1] += kd[1]*ld[1]*nl+ks[1]*ls[1]*Math.pow(nh,n);
        color[2] += kd[2]*ld[2]*nl+ks[2]*ls[2]*Math.pow(nh,n);
    }
    return color;
}

//change color coefficient
function addColor(clr,add){
    clr[0]= Math.round((clr[0]+add)*10);
    clr[1]= Math.round((clr[1]+add)*10);
    clr[2]= Math.round((clr[2]+add)*10);
    clr[0]=clr[0]%11/10;
    clr[1]=clr[1]%11/10;
    clr[2]=clr[2]%11/10;
    return clr;
}

//hardcode triangle
function triangleJson(){
    var str = [
      {
        "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.4,0.4], "specular": [0.3,0.3,0.3], "n":11}, 
        "vertices": [[0.15, 0.6, 0.75],[0.25, 0.9, 0.75],[0.35,0.6,0.75]],
        "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
        "triangles": [[0,1,2]]
      },
      {
        "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17}, 
        "vertices": [[0.15, 0.15, 0.75],[0.15, 0.35, 0.75],[0.35,0.35,0.75],[0.35,0.15,0.75]],
        "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
        "triangles": [[0,1,2],[2,3,0]]
      }
    ]
    return str; 
}

//hardcode ellipsoid
function ellipesJson(){
    var str = [
        {"x": 0.75, "y": 0.75, "z": 0.5, "a":0.2, "b":0.2, "c":0.1, "ambient": [0.1,0.1,0.1], "diffuse": [0.0,0.0,0.6], "specular": [0.3,0.3,0.3], "n":5},
        {"x": 0.75, "y": 0.25, "z": 0.5, "a":0.2, "b":0.15, "c":0.1, "ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.0,0.6], "specular": [0.3,0.3,0.3], "n":7},
        {"x": 0.5, "y": 0.5, "z": 0.5, "a":0.15, "b":0.25, "c":0.1, "ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.0], "specular": [0.3,0.3,0.3], "n":9}
        ]
    return str; 
}

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles(lights,eye) {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    // var inputTriangles = triangleJson();
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        var clrToAdd = vec3.create();

        triNum = inputTriangles.length;

        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            //get vertices,material
            var ka = inputTriangles[whichSet].material.ambient;
            var kd = inputTriangles[whichSet].material.diffuse;
            var ks = inputTriangles[whichSet].material.specular;
            var n = inputTriangles[whichSet].material.n;
            var center =[0,0,0];
            verLength = inputTriangles[whichSet].vertices.length;


            //compute triangle center
            for (whichSetVert=0; whichSetVert<verLength; whichSetVert++) {
                var coord = inputTriangles[whichSet].vertices[whichSetVert];
                center[0] += coord[0]/verLength;
                center[1] += coord[1]/verLength;
                center[2] += coord[2]/verLength;
            }

            //change selected color
            if(whichSet == selectTri){
                n+=selectN;
                n%=21;
                ka = addColor(ka,selectA);
                kd = addColor(kd,selectD);
                ks = addColor(ks,selectS);
                // center[0] += tranX;
                // center[1] += tranY;
                // center[2] += tranZ;
            }
            // center = translate(center,tranX,tranY,tranZ);//move selected model when press key
            for (whichSetVert=0; whichSetVert<verLength; whichSetVert++) {

                var coord = inputTriangles[whichSet].vertices[whichSetVert];
                if(whichSet == selectTri){ 
                    coord = scale(coord,center,1.2);//highlight selected triangle
                    coord = rotate(coord,center,rotMatrix);//rotate selected triangle when press key
                    coord = translate(coord,-tranX,-tranY,-tranZ);
                }

                coord = rotate(coord,lookAt,viewMatrix); //rotate view when press key
                vtxToAdd = transform(coord,eye); //
                var normal = inputTriangles[whichSet].normals[whichSetVert];

                for(vtxIndex=0; vtxIndex<vtxToAdd.length; vtxIndex++){
                    coordArray.push(vtxToAdd[vtxIndex]); //push vertices to buffer
                }
                var color = lighting(eye,lights,normal,coord,ka,kd,ks,n,blinn);
                coordArray.push(color[0],color[1],color[2]);//push color to buffer
                vtxBufferSize +=1;

            } // end for vertices in set
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);
                for(triIndex=0; triIndex<vtxToAdd.length; triIndex++){
                    indexArray.push(triToAdd[triIndex]);
                    triBufferSize += 1; //the triangle index buffer may duplicate(different triangle use the same vertex)
                }
            } // end for triangles in set

        } // end for each triangle set 

    } // end if triangles found
} // end load triangles

// read ellipsoid in, load them into webgl buffers
function loadEllipes(lights,eye) {
    // var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    // var inputEcllipes = ellipesJson();

    var inputEcllipes = getJSONFile(INPUT_SPHERES_URL,"ellipsoids");

    if (inputEcllipes != String.null) { 
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        var clrToAdd = vec3.create();

        var latInt = 100;//devide ellipsoid latitude into 100
        var lonInt = 100;//devide ellipsoid longitude into 100
        ellNum = inputEcllipes.length;
        for (var whichSet=0; whichSet<inputEcllipes.length; whichSet++) {

            //get color
            var ka = inputEcllipes[whichSet].ambient;
            var kd = inputEcllipes[whichSet].diffuse;
            var ks = inputEcllipes[whichSet].specular;
            var n = inputEcllipes[whichSet].n;
            var la = lights.ambient;
            var ld = lights.diffuse;
            var ls = lights.specular;

            //get center and radius
            var radiusA = inputEcllipes[whichSet].a;
            var radiusB = inputEcllipes[whichSet].b;
            var radiusC = inputEcllipes[whichSet].c;

            var centerX = inputEcllipes[whichSet].x;
            var centerY = inputEcllipes[whichSet].y;
            var centerZ = inputEcllipes[whichSet].z;

            //highlight, translate and change color coe on selected model
            if(whichSet == selectEll){
                n+=selectN;
                n%=21;
                ka = addColor(ka,selectA);
                kd = addColor(kd,selectD);
                ks = addColor(ks,selectS);

                radiusA *= 1.2;
                radiusB *= 1.2;
                radiusC *= 1.2;
                centerX -= tranX;
                centerY -= tranY;
                centerZ -= tranZ;
            }


            for (var lat = 0; lat <= latInt; lat++) {
              var theta = lat * Math.PI / latInt;
              var sinTheta = Math.sin(theta);
              var cosTheta = Math.cos(theta);

              for (var lon = 0; lon <= lonInt; lon++) {
                var phi = lon * 2 * Math.PI / lonInt;
                var sinPhi = Math.sin(phi);
                var cosPhi = Math.cos(phi);

                var x = cosPhi * sinTheta;
                var y = cosTheta;
                var z = sinPhi * sinTheta;

                //get coordinate of vertex on ellipsoid
                x = radiusA * x + centerX;
                y = radiusB * y + centerY;
                z = radiusC * z + centerZ;

                var coord =vec3.fromValues(x,y,z);

                if(whichSet == selectEll){//rotate selected object
                    coord = rotate(coord,[centerX,centerY,centerZ],rotMatrix);
                }

                //compute normal of vertex
                var normal = vec3.clone(getnormal(coord,[centerX,centerY,centerZ],[radiusA,radiusB,radiusC]));
                vec3.normalize(normal,normal);

                //get color
                var color = lighting(eye,lights,normal,coord,ka,kd,ks,n,blinn);
                
                //rotate view when press key
                coord = rotate(coord,lookAt,viewMatrix);
                var coord = transform(coord,eye);

                coordArray.push(coord[0],coord[1],coord[2]);//push vertices to buffer
                coordArray.push(color[0],color[1],color[2]);//push color to buffer

                var first =  vtxBufferSize;
                var second = first + lonInt + 1;

                vtxBufferSize +=1;

                indexArray.push(first,second,first + 1);//push index to buffer
                indexArray.push(second,second + 1,first + 1);

                triBufferSize +=6;
              }
            }
            triBufferSize -=triBufferSize/latInt/6;
        } // end for each triangle set 
        
    } // end if triangles found
} // end load triangles

function getnormal(coord,center,radius){
    var x = (coord[0]*2-center[0]*2)/radius[0]/radius[0];
    var y = (coord[1]*2-center[1]*2)/radius[1]/radius[1];
    var z = (coord[2]*2-center[2]*2)/radius[2]/radius[2];
    return [x,y,z];
}

function bindBuffers(){
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer
}
// setup the webGL shaders
function setupShaders() {
    var fShaderCode = `

        precision lowp float;  
        varying lowp vec4 v_Color;

        void main(void) {
            gl_FragColor = v_Color; // all fragments are white
        }
    `;


    var vShaderCode = `

        precision lowp float;
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying lowp vec4 v_Color;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            v_Color = vec4(vertexColor,1.0);
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor"); 
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function renderObjects() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // vertex buffer: activate and feed into vertex shader
    // gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,4*6,0); // feed
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,4*6,4*3); // feed

    // triangle buffer: activate and render
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    // console.log(triBufferSize);
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

} // end render triangles

//reset all the configuration
function reset(){
    at = new vec3.fromValues(0,0,1);
    viewUp = new vec4.fromValues(0,1,0);
    Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
    selectTri = -1;
    selectEll = -1;
    viewMatrix = mat4.create();
    changeSelect();
    redraw();
    drawObjects(Eye); 
}

//when change selected object, reset transformation
function changeSelect(){
    blinn = true;
    selectN = 0;
    selectA = 0;
    selectD = 0;
    selectS = 0;
    tranX =0;
    tranY =0;
    tranZ =0;
    rotMatrix = mat4.create();
}

//reset gl buffer
function redraw(){
    gl = null; // the all powerful gl object. It's all here folks!
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

    coordArray = []; // 1D array of vertex coords for WebGL
    indexArray = []; // 1D array of vertex indices for WebGL
}

//event listener, listen to keyboard
document.addEventListener('keyup', function(event) {
    // console.log("execution:"+event.code);
    if(event.shiftKey){//Upper case with shift
        switch(event.code){
            case "KeyK":
                rotMatrix = getRotateMatrix(-30,rotMatrix,"y");
                break;
            case "Semicolon":
                rotMatrix = getRotateMatrix(30,rotMatrix,"y");
                break;
            case "KeyO":
                rotMatrix = getRotateMatrix(30,rotMatrix,"x");
                break;
            case "KeyL":
                rotMatrix = getRotateMatrix(-30,rotMatrix,"x");
                break;
            case "KeyI":
                rotMatrix = getRotateMatrix(30,rotMatrix,"z");
                break;
            case "KeyP":
                rotMatrix = getRotateMatrix(-30,rotMatrix,"z");
                break;
            case "KeyA":
                viewMatrix = getRotateMatrix(-30,viewMatrix,"y");
                break;
            case "KeyD":
                viewMatrix = getRotateMatrix(30,viewMatrix,"y");
                break;
            case "KeyW":
                viewMatrix = getRotateMatrix(-30,viewMatrix,"x");
                break;
            case "KeyS":
                viewMatrix = getRotateMatrix(30,viewMatrix,"x");
                break;
        }
    }
    else{//lower case
        switch(event.code) {
            case "KeyQ":
                vec3.add(Eye,Eye,[0,-0.1,0]);
                vec3.add(lookAt,lookAt,[0,-0.1,0]);
                // vec3.add(at,at,[0,-0.1,0]);
                break;
            case "KeyE":
                vec3.add(Eye,Eye,[0,0.1,0]);
                vec3.add(lookAt,lookAt,[0,0.1,0]);
                // vec3.add(at,at,[0,0.1,0]);
                break;
            case "KeyA":
                vec3.add(Eye,Eye,[0.1,0,0]);
                vec3.add(lookAt,lookAt,[0.1,0,0]);
                // vec3.add(at,at,[0.1,0,0]);
                break;
            case "KeyD":
                vec3.add(Eye,Eye,[-0.1,0,0]);
                vec3.add(lookAt,lookAt,[-0.1,0,0]);
                // vec3.add(at,at,[-0.1,0,0]);
                break;
            case "KeyW":
                vec3.add(Eye,Eye,[0,0,0.1]);
                vec3.add(lookAt,lookAt,[0,0,0.1]);
                // vec3.add(at,at,[0,0,0.1]);
                break;
            case "KeyS":
                vec3.add(Eye,Eye,[0,0,-0.1]);
                vec3.add(lookAt,lookAt,[0,0,-0.1]);
                // vec3.add(at,at,[0,0,-0.1]);
                break;
            case "ArrowLeft":
                if(triNum > 0){
                    selectTri = selectPrev(selectTri, triNum);
                    selectEll = -1;
                }
                break;
            case "ArrowRight":
                if(triNum > 0){
                    selectTri = selectNext(selectTri, triNum);
                    selectEll = -1;
                }
                break;
            case "ArrowDown":
                if(ellNum > 0){
                    selectEll = selectPrev(selectEll, ellNum);
                    selectTri = -1;
                }
                break;
            case "ArrowUp":
                if(ellNum>0){
                    selectEll = selectNext(selectEll, ellNum);
                    selectTri = -1;
                }
                break;
            case "Space":
                changeSelect();
                selectTri = -1;
                selectEll = -1;
                break;
            case "KeyB":
                blinn = !blinn;
                break;
            case "KeyN":
                selectN +=1;
                break;
            case "Digit1":
                selectA +=0.1;
                break;
            case "Digit2":
                selectD +=0.1;
                break;
            case "Digit3":
                selectS +=0.1;
                break;
            case "KeyK":
                tranX -=0.1;
                break;
            case "Semicolon":
                tranX +=0.1;
                break;
            case "KeyO":
                tranZ +=0.1;
                break;
            case "KeyL":
                tranZ -=0.1;
                break;
            case "KeyI":
                tranY -=0.1;
                break;
            case "KeyP":
                tranY +=0.1;
                break;
            default:
                break;
        }
    }
    // console.log("select:",selectTri,selectEll);
    // console.log("view:",viewMatrix);
    // console.log("rotate:",rotMatrix);
    redraw();
    drawObjects(Eye); 
});

function getRotateMatrix(degree, mat, axis){
    var rad = degree*Math.PI/180;
    switch(axis){
        case "x":
            rotMat = mat4.rotateX(mat,mat,rad);
            break;
        case "y":
            rotMat = mat4.rotateY(mat,mat,rad);
            break;
        case "z":
            rotMat = mat4.rotateZ(mat,mat,rad);
            break;
        default:
            break;
    }
    return mat;
}
function selectNext(index, num){//change selected object to next
    if(index < num -1) index+=1;
    else index = 0;
    changeSelect();
    return index;
}

function selectPrev(index, num){//change selected object to previous
    if(index <=0) index = num-1;
    else index -= 1;
    changeSelect();
    return index;
}
function getEye(){
    return Eye;
}

//draw function
function drawObjects(eye){
    var lights = getJSONFile(INPUT_LIGHTS_URL,"lights");
    setupWebGL(); // set up the webGL environment
    loadTriangles(lights,eye); // load in the triangles from tri file
    loadEllipes(lights,eye); // load in the triangles from tri file
    bindBuffers();
    setupShaders(); // setup the webGL shaders
    renderObjects(); // draw the triangles using webGL
}

function main() {
    drawObjects(Eye);
} // end main
