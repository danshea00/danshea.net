
// Lines

const l = ( sketch ) => {


    var vertices;
    var size = document.getElementById('p5_animations').offsetWidth;
    var scl = 150;

    sketch.setup = () => {
        var myCanvas = sketch.createCanvas(size, size);
        myCanvas.parent('p5_animations');
        sketch.frameRate(0.3);
        vertices = createArray(scl + 1, scl + 1);
    }

    sketch.draw = () => {
        sketch.clear();
        sketch.stroke(sketch.color(localStorage.getItem("pref-theme") == 'dark' ? 'white' : 'black'));
        sketch.noFill();
        sketch.rect(0, 0, sketch.width, sketch.height);

        var interval = sketch.width/scl;
        // Calculate vertices
        for (let i = 0; i < scl+1; i++) {
            for (let j = 0; j < scl+1; j++) {
                vertices[i][j] = sketch.floor(sketch.random(0,2));
            }
        }

        // Draw lines
        for (let i = 0; i < scl; i++) {
            for (let j = 0; j < scl; j++) {
                sketch.noFill();
                // stroke(255);
                sketch.beginShape();
                switch (binaryToInt(vertices[i][j], vertices[i+1][j], vertices[i+1][j+1], vertices[i][j+1])) {
                    case 0:
                        break;
                    case 1:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        break;
                    case 2:
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 3:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 4:
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 5:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 6:
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        break;
                    case 7:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval+interval/2, j*interval);
                        break;
                    case 8:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval/2, j*interval);
                        break;
                    case 9:
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        break;
                    case 10:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 11:
                        sketch.vertex(i*interval + interval/2, j*interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 12:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 13:
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        sketch.vertex(i*interval + interval, j*interval + interval/2);
                        break;
                    case 14:
                        sketch.vertex(i*interval, j*interval + interval/2);
                        sketch.vertex(i*interval + interval/2, j*interval + interval);
                        break;
                    case 15:
                        break;
                }
                sketch.endShape();
            }
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


// Rose

const r = ( sketch ) => {
    var size = document.getElementById('p5_animations').offsetWidth;
        
    sketch.setup = () => {
            var myCanvas = sketch.createCanvas(size, size);
            myCanvas.parent('p5_animations');
            sketch.frameRate(0.9);
            let n = 0;
            let d = 0;
        }
        
    sketch.draw = () => {
        sketch.clear();
        n = sketch.random(50);
        d = sketch.random (50);
    
        sketch.translate(sketch.width/2, sketch.height/2);
        sketch.stroke(sketch.color(localStorage.getItem("pref-theme") == 'dark' ? 'white' : 'black'));
    
        sketch.noFill();
        sketch.beginShape();
        for (let i = 0; i <= 360; i++) {
            let k = i * d;
            let r = size/2 * sketch.sin(sketch.radians(n * k));
            let x = r * sketch.cos(sketch.radians(k));
            let y = r * sketch.sin(sketch.radians(k));
            sketch.vertex(x, y);
        }
        sketch.endShape();
    }
}   

let a = new p5(l);
let b = new p5(r);