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

//Texture Vars
var texturedObject;


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

    var viewMatrix = new Matrix4();
    // FOV, Persp, Near, Far // X, Y, Z
    viewMatrix.setPerspective(camSettings.perspFov, camSettings.perspAspect,
        camSettings.perspNear, camSettings.perspFar)
        .lookAt(camSettings.camX, camSettings.camY, camSettings.camZ,
            0, 0, 0, 0, 1, 0);

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

