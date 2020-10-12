"use strict"; 

var canvas;
var gl;

var vertices = [];
var colors = [];
window.onload = init; // CALL INIT AFTER THE PAGE (all html body) HAS BEEN LOADED!!!!



function init() {    
    canvas = document.getElementById( "gl-canvas" ); // getting the canvas element

    gl = WebGLUtils.setupWebGL( canvas ); // setting up webgl with the canvas
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // initialization of the data arrays!!!!
    vertices = [
        vec3( -0.5, -0.5, 0.0 ), // every vec3 stores 3 coordinates for one point
        vec3(  0,    0.5, 0.0 ),
        vec3(  0.5, -0.5, 0.0 )
    ];
    colors = [
        vec4( 1, 0, 0, 1 ), // every vec4 stores 4 rgba color components for one point
        vec4( 1, 1, 0, 1 ),
        vec4( 0, 0, 1, 1 )
    ];
    

    // the size of the viewport
    gl.viewport( 0, 0, canvas.width, canvas.height );
    // the color of background!
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );

    var program = initShaders( gl, "vertex-shader", "fragment-shader" ); // initializing shaders
    gl.useProgram( program );

    /// SENDING THE DATA TO OUR SHADER!!!!!!!!
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW ); // SET THE DATA, SPECIFY THE ARRAY, vertices in this case
    var vAttributeLocation = gl.getAttribLocation( program, 'vPosition' ); // SET THE LOCATION (pick any variable name to be accessible within the v-shader)
    gl.vertexAttribPointer( vAttributeLocation, 3, gl.FLOAT, false, 0, 0 ); // DESCRIBE THE DATA: EACH vertex has 3 values of type FLOAT
    gl.enableVertexAttribArray( vAttributeLocation);

    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
    var cAttributeLocation = gl.getAttribLocation( program, 'vColor' );
    gl.vertexAttribPointer( cAttributeLocation, 4, gl.FLOAT, false, 0, 0 ); // DESCRIBE THE DATA: EACH vertex has 4 values of type FLOAT
    gl.enableVertexAttribArray( cAttributeLocation);

    render();
};

function render() {
    gl.clear( gl.COLOR_BUFFER_BIT ); 
    gl.drawArrays( gl.TRIANGLES, 0, vertices.length );  // THE ACTUAL DRAW!!!!!!!
    requestAnimFrame(render); // updating the image, will be used for dynamic display
}
