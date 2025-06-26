const svg = document.getElementById("svg");
const innerCircle = document.getElementById("innerCircle");
const outerCircle = document.getElementById("outerCircle");

const pointOnCircle = (center, radius, angle) => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
});

const drawCircle = (g, center, radius) => {
    const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
    );
    path.setAttribute("cx", center.x);
    path.setAttribute("cy", center.y);
    path.setAttribute("r", radius);
    path.setAttribute("class", "small-circle");
    g.appendChild(path);
};

const drawCircleOfCircles = (
    g,
    center,
    radius,
    numberOfCircles,
    circleRadius,
) => {
    for (let i = 0; i < numberOfCircles; i++) {
        const startAngle = (i * Math.PI * 2) / numberOfCircles;
        const circleCenter = pointOnCircle(center, radius, startAngle);
        drawCircle(g, circleCenter, circleRadius);
    }
};

const circleRadius = 10;
const center = { x: 250, y: 250 };
const numberOfCircles = 32;

const innerRadius = 175;
drawCircleOfCircles(
    innerCircle,
    center,
    innerRadius,
    numberOfCircles,
    circleRadius,
);

const outerRadius = 205;
drawCircleOfCircles(
    outerCircle,
    center,
    outerRadius,
    numberOfCircles,
    circleRadius,
);
