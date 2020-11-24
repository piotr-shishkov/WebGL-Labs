//Main Vars
var gl;
var canvas;
var camSettings = {
    perspFov: 70,
    perspAspect: 1,
    perspNear: 1,
    perspFar: 100,
    camX: 0,
    camY: 3,
    camZ: 6
}

var objects = []

//Texture Vars
var texturedObject;

//Light Vars
var ambientColor = [0.25, 0.25, 0.25];

var diffuseDirection = [-1.0, 2.0, 4.0];
var diffuseColor = [0.3, 0.3, 0.3];

var pointedPosition = [3, 3.0, 4];
var pointedColor = [0.5, 0.5, 0.5];

var no_light = [0, 0, 0]

function main() {
    canvas = document.getElementById('gl-canvas');

    gl = getWebGLContext(canvas);
    if (!gl)
        alert("WebGL isn't available");

    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE))
        alert('Shader initialization failed.');

    //Listen for files input
    listenForObjectLoad();
    listenForTextureLoad();

    setInterval(() => { render(gl) }, 15);
}

function render(gl) {
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
    var u_LightColorPointed =  gl.getUniformLocation(gl.program, 'u_LightColorPointed');
    var u_LightColorDiffuse = gl.getUniformLocation(gl.program, 'u_LightColorDiffuse');
    var u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');
    var u_LightColorAmbient = gl.getUniformLocation(gl.program, 'u_LightColorAmbient');
    
    // Pointed Light
    gl.uniform3fv(u_LightPosition, new Float32Array(pointedPosition));
    
    if (document.getElementById('point').checked) 
    {
        gl.uniform3fv(u_LightColorPointed, new Float32Array(pointedColor));
    } 
    else {
        gl.uniform3fv(u_LightColorPointed, new Float32Array(no_light));
    }

    // Diffuse Light
    if (document.getElementById('diffuse').checked) 
    {
        gl.uniform3fv(u_LightColorDiffuse, new Float32Array(diffuseColor));
    } else 
    {
        gl.uniform3fv(u_LightColorDiffuse, new Float32Array(no_light));
    }

    gl.uniform3fv(u_LightDirection, new Float32Array(diffuseDirection));

    // Ambient Light
    if (document.getElementById('ambient').checked) 
    {
        gl.uniform3fv(u_LightColorAmbient, new Float32Array(ambientColor));
    } else 
    {
        gl.uniform3fv(u_LightColorAmbient, new Float32Array(no_light));
    }

    var viewMatrix = new Matrix4();
    // FOV, Persp, Near, Far // X, Y, Z
    viewMatrix.setPerspective(camSettings.perspFov, camSettings.perspAspect,
        camSettings.perspNear, camSettings.perspFar)
        .lookAt(camSettings.camX, camSettings.camY, camSettings.camZ,
            0, 0, 0, 0, 1, 0);
    for (let obj of objects) {
        var n = initBuffers(gl, obj);

        var u_Transform = gl.getUniformLocation(gl.program, 'u_Transform');
        var transformMatrix = new Matrix4();
        transformMatrix
            .setTranslate(obj.posX, obj.posY, obj.posZ)
            .scale(obj.scale, obj.scale, obj.scale);

        var translateMatrix = new Matrix4();
        translateMatrix.setTranslate(obj.translate[0], obj.translate[1], obj.translate[2]);
        transformMatrix.multiply(translateMatrix);

        gl.uniformMatrix4fv(u_Transform, false, transformMatrix.elements);

        var u_Mvp = gl.getUniformLocation(gl.program, 'u_Mvp');
        var mvpMatrix = new Matrix4();
        mvpMatrix.set(viewMatrix).multiply(transformMatrix);
        gl.uniformMatrix4fv(u_Mvp, false, mvpMatrix.elements);
        
        var u_Rotate = gl.getUniformLocation(gl.program, 'u_Rotate');
        var rotateMatrix = new Matrix4();
        rotateMatrix.setRotate(obj.isRotating ? obj.angle += 3 : obj.angle, obj.rotX, obj.rotY, obj.rotZ);
        gl.uniformMatrix4fv(u_Rotate, false, rotateMatrix.elements);

        var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
        var normalMatrix = new Matrix4();
        transformMatrix.multiply(rotateMatrix);
        normalMatrix.setInverseOf(transformMatrix);
        normalMatrix.transpose();
        gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

        gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
    }
    if (texturedObject != null) 
    {
        n = initBuffers(gl, texturedObject);

        u_Mvp = gl.getUniformLocation(gl.program, 'u_Mvp');
        mvpMatrix = new Matrix4();
        mvpMatrix.set(viewMatrix);
        gl.uniformMatrix4fv(u_Mvp, false, mvpMatrix.elements);

        u_Rotate = gl.getUniformLocation(gl.program, 'u_Rotate');
        rotateMatrix = new Matrix4();
        rotateMatrix.setRotate(texturedObject.angle += 2, 1, 1, 1);
        gl.uniformMatrix4fv(u_Rotate, false, rotateMatrix.elements);
       
        u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
        normalMatrix = new Matrix4();
        normalMatrix.setInverseOf(rotateMatrix);
        normalMatrix.transpose();
        gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

        gl.drawArrays(gl.TRIANGLES, 0, n);

    }
}

function initBuffers(gl, obj) 
{
    if (!initArrayBuffer(gl, 'a_Position', obj.vertices, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Color', obj.colors, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Normal', obj.normals, 3, gl.FLOAT)) return -1;
    
    if (obj.indices != null) 
    {
        var indicesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.indices, gl.STATIC_DRAW);
        return obj.indices.length;
    } 
    else 
    {
        var tcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, tcBuffer);
        gl.bufferData( gl.ARRAY_BUFFER, flatten(obj.textures), gl.STATIC_DRAW );
        var tcAttributeLocation = gl.getAttribLocation( gl.program, 'vTextureCoord');
		gl.vertexAttribPointer( tcAttributeLocation, 2, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( tcAttributeLocation);
        
        var textureDataLocation = gl.getUniformLocation(gl.program, 'textureData');
        gl.uniform1i(textureDataLocation, 0);
        return obj.vertices.length;
    }
}
function initArrayBuffer (gl, attribute, data, num, type)
{
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var a_attribute = gl.getAttribLocation(gl.program, attribute);
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return true;
}

function listenForObjectLoad() {
    document.querySelector("#obj-input").addEventListener('change', function() {
        var selectedFiles = this.files;
        if(selectedFiles.length == 0) {
			alert('Error: You need to select file!');
            return;
        }
        var file = selectedFiles[0];
        loadObject(file);
    });
}
function listenForTextureLoad(){	
	document.querySelector('#text-input').addEventListener('change', function() {						
		var selectedFiles = this.files;		
		if(selectedFiles.length == 0) {
			alert('Error: You need to select file!');
			return;
		}
		var file = selectedFiles[0];
		loadTexture(file);
	});	
}

function loadObject(file)
{
    console.log("Listener detected Object");
    var fReader = new FileReader();
    fReader.addEventListener('load', function(d){
        var data = d.target.result;
        parseObject(data);
    });
    fReader.addEventListener('error', function() {
        alert('FileError!');
    });

    fReader.readAsText(file);
}
function parseObject(text)
{
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
  
    const objVertexData = [
      objPositions,
      objTexcoords,
      objNormals,
    ];
  
    let webglVertexData = [
      [],   // pos
      [],   // text
      [],   // norm
    ];
  
    function addVertex(vert) {
      const ptn = vert.split('/');
      ptn.forEach((objIndexStr, i) => {
        if (!objIndexStr) {
          return;
        }
        const objIndex = parseInt(objIndexStr);
        const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
        webglVertexData[i].push(...objVertexData[i][index]);
      });
    }
  
    const keywords = {
      v(parts) {
        objPositions.push(parts.map(parseFloat));
      },
      vn(parts) {
        objNormals.push(parts.map(parseFloat));
      },
      vt(parts) {
        objTexcoords.push(parts.map(parseFloat));
      },
      f(parts) {
        const numTriangles = parts.length - 2;
        for (let tri = 0; tri < numTriangles; ++tri) {
          addVertex(parts[0]);
          addVertex(parts[tri + 1]);
          addVertex(parts[tri + 2]);
        }
      },
    };
  
    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
      const line = lines[lineNo].trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }
      const m = keywordRE.exec(line);
      if (!m) {
        continue;
      }
      const [, keyword, unparsedArgs] = m;
      const parts = line.split(/\s+/).slice(1);
      const handler = keywords[keyword];
      if (!handler) {
        console.warn('parse keyword error:', keyword); 
        continue;
      }
      handler(parts, unparsedArgs);
    }

    var vertices = webglVertexData[0];
    var textcoord = webglVertexData[1];
    var normals = webglVertexData[2];

    var textures = [];
    for (let i = 0; i < textcoord.length; i += 2) {
        textures.push(vec2(textcoord[i], 1 - textcoord[i+1]));
        i++;
    }
  
    texturedObject = new TexturedObject(
        new Float32Array(vertices),
        null,
        new Float32Array(normals),
        textures);

    fillSelectList();
}

function loadTexture(file)
{
    console.log("Listener detected texture");
    var fReader = new FileReader();
    fReader.addEventListener('load', function(d){
        var data = d.target.result;
        allignTexture(data);
    })

    fReader.addEventListener('error', function() {
        alert('FileError!');
    });

    fReader.readAsDataURL(file);

}
function allignTexture(data)
{
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const intFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;

    var image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, intFormat, srcFormat, srcType, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    image.src = data;

    return texture;
}

//Object Controls
//#region 
function setRot(state, axis) {
    var index = document.getElementById('selectObject').value;
    toggleRotation(objects[index], state, axis)
}

function setPos(axis) {
    var index = document.getElementById('selectObject').value;
    switch (axis) {
        case 1:
            var newPosX = document.getElementById('posX').value;
            objects[index].posX = newPosX;
            break;
        case 2:
            var newPosY = document.getElementById('posY').value;
            objects[index].posY = newPosY;
            break;
        case 3:
            var newPosZ = document.getElementById('posZ').value;
            objects[index].posZ = newPosZ;
            break;
    }
}

function setScale() {
    var index = document.getElementById('selectObject').value;
    objects[index].scale = document.getElementById('size').value;
}

//#endregion

function updateCameraSettings(property) {
    var newSettings = parseFloat(document.getElementById(property).value)
    camSettings[property] = newSettings;
}

function updatePointLight(param)
{
    var pposX = document.getElementById('pposX');
    var pposY = document.getElementById('pposY');
    var pposZ = document.getElementById('pposZ');
    var pint = document.getElementById('pint');

    switch(param)
    {
        case 1:
            pointedPosition[0] = pposX.value;
            break;
        case 2:
            pointedPosition[1] = pposY.value;
            break;
        case 3:
            pointedPosition[2] = pposZ.value;
            break;
        case 4:
            pointedColor = [pint.value, pint.value, pint.value];
            break;
    }
}

function addObject(objectType) {
    if (objects.length === 3) {
        alert('You can add only three objects on this canvas. Remove one and try again!');
        return;
    }

    switch (objectType) {
        case 1:
            objects.push(createCube());
            break;
        case 2:
            objects.push(createPyramid());
            break;
        case 3:
            objects.push(createCylinder());
            break;
        case 4:
            objects.push(createCone());
            break;
        case 5:
            objects.push(createSphere());
            break;
        default:
            alert("Error! Object type unvalid!");
            break;
    }

    switch (objects.length) {
        case 1:
            objects[objects.length - 1].translate = [-2, 0, 0];
            break;
        case 2:
            objects[objects.length - 1].translate = [0, 0, 0];
            break;
        case 3:
            objects[objects.length - 1].translate = [2, 0, 0];
            break;
        default:
            alert("Unexppected Error!");
            break;
    }

    fillSelectList();
}

class Object {
    constructor(vertices, indices, colors, normals) {
        this.vertices = vertices;
        this.colors = colors
        this.indices = indices;
        if (normals == null) this.normals = vertices;
        else this.normals = normals;
        this.scale = 1.0;
        this.posX = 0;
        this.posY = 0;
        this.posZ = 0;
        this.translate = [0, 0, 0];

        this.angle = 0;
        this.rotX = 1;
        this.rotY = 0;
        this.rotZ = 0;
        this.isRotating = false;
    }
}

class TexturedObject {
    constructor(vertices, indices, normals, textures) {
        this.vertices = vertices;
        this.normals = normals;
        this.indices = indices;
        this.textures = textures;

        let col = [];
        vertices.forEach(v => col.push(1, 1, 1));
        this.colors = new Uint8Array(col);
        
        this.angle = 0;
    }
}

function toggleRotation(obj, state, axis) 
{
    if (state) 
    {
        obj.isRotating = true;
        console.log(axis);
        switch (axis) 
        {
            case 1:
                applyRotation(obj, 1, 0, 0);
                break;
            case 2:
                applyRotation(obj, 0, 1, 0);
                break;
            case 3:
                applyRotation(obj, 0, 0, 1);
                break;
        }
    }
    else 
    {
        obj.isRotating = false;
        obj.angle = 0;
    }
}

function applyRotation(obj, x, y, z) 
{
    obj.rotX = x;
    obj.rotY = y;
    obj.rotZ = z;
}

function removeObject(all) 
{
    if (all) objects = [];
    else objects.pop();

    fillSelectList();
}

function removeCustomObject()
{
    texturedObject = null;
    gl.bindTexture(gl.TEXTURE_2D, null);
    var objInput = document.getElementById("obj-input");
    var textInput = document.getElementById("text-input");
    objInput.value = "";
    textInput.value = "";
    fillSelectList();
}

function fillSelectList() {
    var selectList = document.getElementById('selectObject')

    for (i = selectList.options.length - 1; i >= 0; i--) {
        selectList.options[i] = null;
    }

    for (i = 0; i < objects.length; i++) {
        var opt = document.createElement("option");
        opt.text = i + 1;
        opt.value = i;
        selectList.options.add(opt);
    }

    selectList.value = objects.length - 1;

    var objControls = document.getElementById("object-controls");
    var camControls = document.getElementById("camera-controls");
    if (objects.length > 0 || texturedObject != null){
        camControls.style.display = "block";
        objControls.style.display = texturedObject == null ? "block" : "none"; 
    }
    else
    {
        objControls.style.display = "none";
        camControls.style.display = "none";
    }
    var cubeButton = document.getElementById("cube-button");
    var pyroButton = document.getElementById("pyramid-button");
    var cylButton = document.getElementById("cylinder-button");
    var coneButton = document.getElementById("conus-button");
    var sphereButton = document.getElementById("sphere-button");
    var objInput = document.getElementById("obj-input");
    var textInput = document.getElementById("text-input");

    if(objects.length > 0)
    {
        objInput.disabled = true;
        objInput.value = "";
        textInput.disabled = true;
        textInput.value= "";
    }
    else if(texturedObject != null)
    {
        cubeButton.disabled=true;
        pyroButton.disabled=true;
        cylButton.disabled=true;
        coneButton.disabled=true;
        sphereButton.disabled=true;
    }
    else
    {
        objInput.disabled = false;
        textInput.disabled = false;
        cubeButton.disabled=false;
        pyroButton.disabled=false;
        cylButton.disabled=false;
        coneButton.disabled=false;
        sphereButton.disabled=false;
    }

}

//Cube Function
function createCube() {
    return new Object(
        new Float32Array([
            0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
            0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5, // v0-v3-v4-v5 right
            0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
           -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
           -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
            0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5 
        ]),
        new Uint8Array([
            0, 1, 2,   0, 2, 3,    // front
            4, 5, 6,   4, 6, 7,    // right
            8, 9,10,   8,10,11,    // up
            12,13,14,  12,14,15,    // left
            16,17,18,  16,18,19,    // down
            20,21,22,  20,22,23     // back
        ]),
        new Float32Array([
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1,     // v1-v1-v2-v3 front
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1,     // v1-v3-v4-v5 right
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1,     // v1-v5-v6-v1 up
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1,     // v1-v6-v7-v2 left
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1,     // v7-v4-v3-v2 down
            1, 1, 1,   1, 1, 1,   1, 1, 1,  1, 1, 1　 
        ])
    );
}
//Pyramid Function
function createPyramid() {
    return new Object(
        new Float32Array([
            0.0, 0.5, 0.0,  // v0
            -0.5, -0.5, 0.5, // v1
            0.5, -0.5, 0.5,  // v2
            0.5, -0.5, -0.5,  // v3
            -0.5, -0.5, -0.5  // v4
        ]),
        new Uint8Array([
            0, 1, 2,  // front
            0, 2, 3,  // right
            0, 1, 4,  // left
            0, 3, 4,  // back
            1, 2, 4, 2, 3, 4  // down
        ]),
        new Float32Array([
            1, 1, 1,  // v0 White
            1, 1, 1,  // v1 Magenta
            1, 1, 1,  // v2 Red
            1, 1, 1,  // v3 Yellow
            1, 1, 1,  // v4 Green
        ])
    );
}
//Cylinder Function
function createCylinder() {
    points = 36 ;
    var vertices = [];
    var colors = [];
    var indices = [];
    const sectors = 2 * Math.PI / points;
    var angle;

    for (let i = 0; i < points; i += 2) {
        angle = i * sectors;
        vertices.push(Math.cos(angle) / 2);
        vertices.push(0.5);
        vertices.push(Math.sin(angle) / 2);
        colors.push(1, 1, 1);
        
            
        vertices.push(Math.cos(angle) / 2);
        vertices.push(-0.5);
        vertices.push(Math.sin(angle) / 2);
        colors.push(1, 1, 1);
        

        if (i % 2 === 0 && i <= points - 4)
            indices.push(i , i + 1, i + 2, i + 1, i + 3, i + 2);
            indices.push(points, i, i + 2);
            indices.push(points + 1, i + 1 , i + 3);
    }

    vertices.push(0, 0.5, 0);
    colors.push(1, 1, 1);
    vertices.push(0, -0.5, 0);
    colors.push(1, 1, 1)

    indices.push(points - 2, points - 1, 0)
    indices.push(points - 1, 1, 0)
    indices.push(points, points - 2, 0)
    indices.push(points + 1, points - 1, 1);

    return new Object(
        new Float32Array(vertices),
        new Uint8Array(indices),
        new Float32Array(colors)
    );
}
//Cone Function
function createCone() {
    points = 22;
    var vertices = [];
    var colors = [];
    var indices = [];
    const sectors = 2 * Math.PI / points;
    var angle;

    vertices.push(0, 0.5, 0);
    colors.push(1, 1, 1)
    for (let i = 0; i < points; i++) {
        angle = i * sectors;
            
        vertices.push(Math.cos(angle) / 2);
        vertices.push(-0.5);
        vertices.push(Math.sin(angle) / 2);
        colors.push(1, 1, 1);
        

        if (i <= points - 2)
            indices.push(0, i, i + 1);
            indices.push(points, i, i + 1);
    }

    vertices.push(0, -0.5, 0);
    colors.push(1, 1, 1);
    indices.push(0, points - 1, 1);

    return new Object(
        new Float32Array(vertices),
        new Uint8Array(indices),
        new Float32Array(colors)
    );
}
//Sphere Function
function createSphere() {
    //Sphere quality
    var SPHERE_DIV = 15;
    var positions = [];
    var indices = [];
    var colors = [];

    for (j = 0; j <= SPHERE_DIV; j++) {
        aj = j * Math.PI / SPHERE_DIV;
        sj = Math.sin(aj);
        cj = Math.cos(aj);
        for (i = 0; i <= SPHERE_DIV; i++) {
            ai = i * 2 * Math.PI / SPHERE_DIV;
            si = Math.sin(ai);
            ci = Math.cos(ai);

            positions.push((si * sj) / 1.5);
            positions.push(cj / 1.5);
            positions.push((ci * sj) / 1.5);

            if (i % 2 === 0) colors.push(1, 1, 1);
            else colors.push(1, 1, 1)
        }
    }

    for (j = 0; j < SPHERE_DIV; j++) {
        for (i = 0; i < SPHERE_DIV; i++) {
            p1 = j * (SPHERE_DIV + 1) + i;
            p2 = p1 + (SPHERE_DIV + 1);

            indices.push(p1);
            indices.push(p2);
            indices.push(p1 + 1);

            indices.push(p1 + 1);
            indices.push(p2);
            indices.push(p2 + 1);
        }
    }

    return new Object(
        new Float32Array(positions),
        new Uint8Array(indices),
        new Float32Array(colors)
    )
}


//Shaders

//Vertex Shader
var VSHADER_SOURCE =
    `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    attribute vec4 a_Normal;
    attribute vec2 vTextureCoord;

    uniform mat4 u_Mvp;
    uniform mat4 u_Transform;
    uniform mat4 u_Rotate;
    uniform mat4 u_NormalMatrix;

    // Diffuse light
    uniform vec3 u_LightDirection;
    uniform vec3 u_LightColorDiffuse;

    // ambient light
    uniform vec3 u_LightColorAmbient;

    // pointed light
    uniform vec3 u_LightPosition;
    uniform vec3 u_LightColorPointed;

    varying vec4 v_Color;
    varying vec2 fTextureCoord;

    void main() {
        gl_Position = u_Mvp * u_Rotate  * a_Position;

        vec4 normal = normalize(u_NormalMatrix * a_Normal);

        vec4 vertexPosition = u_Transform * u_Rotate * a_Position;
    
        vec3 lightDirection = normalize(u_LightPosition - vec3(vertexPosition));
        float nDotL = max(dot(normal.xyz, lightDirection), 0.0);
        vec3 pointed = u_LightColorPointed * a_Color.xyz * nDotL;

        nDotL = max(dot(u_LightDirection, normal.xyz), 0.0);
        vec3 diffuse = u_LightColorDiffuse * a_Color.xyz * nDotL;

        vec3 ambient = u_LightColorAmbient * a_Color.xyz;
    
        v_Color = vec4(diffuse + pointed + ambient, a_Color.a);
        fTextureCoord = vTextureCoord;
    }`;

//Fragment Shader
var FSHADER_SOURCE =
    `
    #ifdef GL_ES
        precision mediump int;
        precision mediump float;
    #endif
    varying vec4 v_Color;

    uniform sampler2D textureData; 
    varying vec2 fTextureCoord;

    void main() {
        vec4 colorFromTexture = texture2D(textureData, fTextureCoord);
        gl_FragColor = colorFromTexture * 0.5 + v_Color * 0.5;  
    }`;

