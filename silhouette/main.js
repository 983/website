"use strict"
// "use strict" prevents some javascript shenanigans

function toInt(x){
    return x|0
}

var canvas = document.getElementById("myCanvas")
var context = canvas.getContext("2d")

var width = canvas.width
var height = canvas.height

var pixels = context.createImageData(width, height)

var xGradient = new Float32Array(width*height)
var yGradient = new Float32Array(width*height)
var heightMap = new Float32Array(width*height)

for (var i = 0; i < width*height; i++){
    var angle = Math.random()*2*Math.PI
    xGradient[i] = Math.cos(angle)
    yGradient[i] = Math.sin(angle)
}

// linearly interpolate between a and b where u = 0 is a and u = 1 is b
// and u in (0, 1) is inbetween a and b
function lerp(a, b, u){
    return a + (b - a)*u
}

// make sure x is between a and b
function clamp(x, a, b){
    if (x < a) return a
    if (x > b) return b
    return x
}

// curve with properties:
// smoothCurve(0) = 0
// smoothCurve(1) = 1
// smoothCurve'(0) = 0
// smoothCurve'(1) = 0
function smoothCurve(t){
    return t*t*(3 - 2*t)
}

// dot product of random gradients with direction vector
function dotGridGradient(ix, iy, x, y){
    var dx = x - ix
    var dy = y - iy
    
    // index into 2d array
    var i = ix + iy*width
    
    return dx*xGradient[i] + dy*yGradient[i]
}

// https://en.wikipedia.org/wiki/Perlin_noise
function perlinNoise(x, y){
    var x0 = toInt(x)
    var x1 = x0 + 1
    var y0 = toInt(y)
    var y1 = y0 + 1
    
    var ux = x - x0
    var uy = y - y0
    
    ux = smoothCurve(ux)
    uy = smoothCurve(uy)
    
    var d00 = dotGridGradient(x0, y0, x, y)
    var d01 = dotGridGradient(x0, y1, x, y)
    var d10 = dotGridGradient(x1, y0, x, y)
    var d11 = dotGridGradient(x1, y1, x, y)
    
    var d0 = lerp(d00, d10, ux)
    var d1 = lerp(d01, d11, ux)
    
    return lerp(d0, d1, uy)
}

// sum of perlin noise at different scales looks more interesting
function perlinNoiseOctaves(x, y, n){
    var result = 0
    var scale = 1
    var sum = 0
    for (var i = 0; i < n; i++){
        result += perlinNoise(x, y)*scale
        sum += scale
        scale *= 0.5
        x *= 2
        y *= 2
    }
    return result/sum
}

function initializeHeightMap(){   
    for (var y = 0; y < height; y++){
        for (var x = 0; x < width; x++){
            var scale = 0.01
            var value = perlinNoiseOctaves(x*scale, y*scale, 2)
            // from range [-1, 1] to range [0, 1]
            value = value*0.5 + 0.5
            
            if (x > 100 && x < 200 && y > 100 && y < 200){
                value = 0
            }
            if (x > 150 && x < 250 && y > 150 && y < 250){
                value = 1
            }
            
            heightMap[x + y*width] = value
        }
    }
}

function heightMapToPixels(){
    for (var i = 0; i < width*height; i++){
        var gray = heightMap[i]*255
        
        var red   = gray
        var green = gray
        var blue  = gray
        var alpha = 0xff
        
        // pixels.data stores pixels in RGBA order
        // one byte per color
        pixels.data[i*4 + 0] = red
        pixels.data[i*4 + 1] = green
        pixels.data[i*4 + 2] = blue
        pixels.data[i*4 + 3] = alpha
    }
}

// https://de.wikipedia.org/wiki/Bresenham-Algorithmus#Kompakte_Variante
function bresenhamLine(x0, y0, x1, y1, setPixel){
    var dx = +Math.abs(x1 - x0)
    var dy = -Math.abs(y1 - y0)
    var sx = x0 < x1 ? 1 : -1
    var sy = y0 < y1 ? 1 : -1
    
    var err = dx + dy
    
    while (true){
        if (setPixel(x0, y0)) break
        
        if (x0 == x1 && y0 == y1) break
        
        var e2 = err*2
        
        if (e2 > dy){
            err += dy
            x0 += sx
        }
        
        if (e2 < dx){
            err += dx
            y0 += sy
        }
    }
}

initializeHeightMap()

var xStart = 256 + 1
var yStart = 256

function redraw(){
    heightMapToPixels()
    
    // distance is longer than any line that would fit on height map
    var distance = 2*Math.max(width, height)
    
    var silhouette = []
    
    var t = window.performance.now()
    
    var viewerHeight = 0.5
    
    var n = 100
    for (var step = 0; step <= n; step++){
        var angle = lerp(0, Math.PI*2.0, step/n)
        
        var bestHeight = 0
        var bestDistance = 1
        
        var xBest = xStart
        var yBest = yStart
        
        var xEnd = toInt(Math.cos(angle)*distance + xStart)
        var yEnd = toInt(Math.sin(angle)*distance + yStart)
        
        bresenhamLine(xStart, yStart, xEnd, yEnd, function(x, y){
            if (x < 0 || x >= width || y < 0 || y >= height) return true
            
            var dx = x - xStart
            var dy = y - yStart
            
            if (dx == 0 && dy == 0) return
            
            var currentDistance = Math.sqrt(dx*dx + dy*dy)
            
            var currentHeight = heightMap[x + y*width] - viewerHeight
            
            if (currentHeight/currentDistance > bestHeight/bestDistance){
                bestHeight = currentHeight
                bestDistance = currentDistance
                xBest = x
                yBest = y
            }
            
            var i = x + y*width
            
            pixels.data[i*4 + 0] = 50
            pixels.data[i*4 + 1] = 50
            pixels.data[i*4 + 2] = 50
            pixels.data[i*4 + 3] = 255
        })
        
        silhouette.push([xBest, yBest, bestHeight])
    }
    
    var dt = window.performance.now() - t
    
    // draw silluete points
    for (var k = 0; k < silhouette.length; k++){
        var x = silhouette[k][0]
        var y = silhouette[k][1]
        
        var i = x + y*width
        
        pixels.data[i*4 + 0] = 0
        pixels.data[i*4 + 1] = 255
        pixels.data[i*4 + 2] = 0
        pixels.data[i*4 + 3] = 255
    }
    
    // dump pixels to screen
    context.putImageData(pixels, 0, 0)
    
    // draw calculation duration
    var text = dt.toFixed(3) + " milliseconds"
    
    context.strokeStyle = "#fff"
    context.font = "20px Arial";
    context.fillText(text, 20, height - 30)
    
    // draw silhouette graph
    context.strokeStyle = "#0ff"
    context.beginPath()
    for (var k = 0; k < silhouette.length; k++){
        var h = silhouette[k][2]
        
        var x = k/silhouette.length*width
        var y = height - h*height
        
        if (k == 0){
            context.moveTo(x, y)
        }else{
            context.lineTo(x, y)
        }
    }
    context.stroke()
    
    // request next frame
    window.requestAnimationFrame(redraw)
}

redraw()

window.onmousemove = function(e){
    var rect = canvas.getBoundingClientRect()
    
    var x = e.clientX - rect.left
    var y = e.clientY - rect.top
    
    xStart = toInt(x)
    yStart = toInt(y)
}
