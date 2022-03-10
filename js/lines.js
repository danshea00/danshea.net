var vertices;
var size = document.getElementById('p5_lines').offsetWidth;
var scl = 150;

function setup() {
	var myCanvas = createCanvas(size, size);
	myCanvas.parent('p5_lines');
	vertices = createArray(scl + 1, scl + 1);
	frameRate(0.5);
}

function draw() {
	clear();

	stroke(color(localStorage.getItem("pref-theme") == 'dark' ? 'white' : 'black'));

	noFill();
	rect(0, 0, width, height);

	var interval = width/scl;
	// Calculate vertices
	for (let i = 0; i < scl+1; i++) {
		for (let j = 0; j < scl+1; j++) {
			vertices[i][j] = floor(random(0,2));
		}
	}

	// Draw lines
	for (let i = 0; i < scl; i++) {
		for (let j = 0; j < scl; j++) {
 			beginShape();
			switch (binaryToInt(vertices[i][j], vertices[i+1][j], vertices[i+1][j+1], vertices[i][j+1])) {
				case 0:
					break;
				case 1:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval/2, j*interval + interval);
					break;
				case 2:
					vertex(i*interval + interval/2, j*interval + interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 3:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 4:
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 5:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval/2, j*interval + interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 6:
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval/2, j*interval + interval);
					break;
				case 7:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval+interval/2, j*interval);
					break;
				case 8:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval/2, j*interval);
					break;
				case 9:
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval/2, j*interval + interval);
					break;
				case 10:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval/2, j*interval + interval);
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 11:
					vertex(i*interval + interval/2, j*interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 12:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 13:
					vertex(i*interval + interval/2, j*interval + interval);
					vertex(i*interval + interval, j*interval + interval/2);
					break;
				case 14:
					vertex(i*interval, j*interval + interval/2);
					vertex(i*interval + interval/2, j*interval + interval);
					break;
				case 15:
					break;
			}
			endShape();
		}
	}

}

function binaryToInt(a, b, c, d) {
	return a * 8 + b * 4 + c * 2 + d * 1;
}

function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}