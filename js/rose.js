let fr = 0.5;
var size = document.getElementById('p5_rose').offsetWidth;


function setup() {
	var myCanvas = createCanvas(size, size);
	myCanvas.parent('p5_rose');
	frameRate(fr);
	let n = 0;
	let d = 0;
}

function draw() {
	clear();
	n = random(50);
	d = random (50);

	translate(width/2, height/2);
  	stroke(255);

	noFill();
	beginShape();
	for (let i = 0; i <= 360; i++) {
		let k = i * d;
		let r = size/2 *sin(radians(n * k));
		let x = r * cos(radians(k));
		let y = r * sin(radians(k));
		vertex(x, y);
	}
	endShape(CLOSE);
}

function mouseClicked() {
	if (fr != 0) fr = 0;
	else if (fr == 0) fr = 0.5;
	frameRate(fr);
}
