require("babel-core/register");
require("babel-polyfill");
require('normalize.css/normalize.css');
require('./styles/index.scss');
import * as d3 from 'd3';

document.addEventListener("DOMContentLoaded", () => {
    const CONTROL = {
        NEUTRAL: 0,
        PLAYER_1: 1,
        PLAYER_2: 2
    };

    const createField = (width, height) => {
        const sites = d3.range(100).map(d => [Math.random() * width, Math.random() * height]);
        const voronoi = d3.voronoi().extent([[0,0],[width, height]])(sites);
        const polygons = voronoi.polygons();
        const centers = polygons.map(p => {
            const nexti = i => (i+1) % p.length;

            let A = 0;
            let x = 0;
            let y = 0;
            p.forEach((v, i) => {
                const nextv = p[nexti(i)];
                A += .5 * (v[0] * nextv[1] - nextv[0] * v[1]);
            });

            p.forEach((v, i) => {
                const nextv = p[nexti(i)];
                x += 1. / (6 * A) * (v[0] + nextv[0]) * (v[0] * nextv[1] - nextv[0] * v[1]);
                y += 1. / (6 * A) * (v[1] + nextv[1]) * (v[0] * nextv[1] - nextv[0] * v[1]);
            });

            return [x, y, A];
        });

        const cells = sites.map((s, i) => ({
            id: i,
            location: sites[i],
            polygon: polygons[i],
            center: centers[i],
            area: -centers[i][2],
            control: CONTROL.NEUTRAL,
            armies: 50
        }));

        cells.forEach((cell, i) => {
            cell.neighbours = [];
            cell.border = false;
            voronoi.cells[i].halfedges.forEach(edgeIndex => {
                const edge = voronoi.edges[edgeIndex];
                if (edge.left && edge.left.index !== i) {
                    cell.neighbours.push(cells[edge.left.index]);
                }
                if (edge.right && edge.right.index !== i) {
                    cell.neighbours.push(cells[edge.right.index]);
                }
                if (!edge.right || !edge.left) {
                    cell.border = true;
                }
            });
        });
        console.log(voronoi.cells);
        const findClosest = (x, y) => {
            let minDistance = null;
            let closest = null;
            for (let c of cells) {
                const distance = (c.location[0] - x)**2 + (c.location[1] - y)**2;
                if (!minDistance || distance < minDistance) {
                    minDistance = distance;
                    closest = c;
                }
            }
            return closest;
        };

        const player1Start = findClosest(50, 0);
        player1Start.control = CONTROL.PLAYER_1;
        player1Start.armies = 200;
        const player2Start = findClosest(50, 100);
        player2Start.control = CONTROL.PLAYER_2;
        player2Start.armies = 200;

        return cells;
    };

    const moves = [];

    const userPlayer = CONTROL.PLAYER_1;

    const addMove = (from, to) => {
        if (from !== to && from.control === userPlayer && from.neighbours.includes(to)) {
            // cell.control = CONTROL.PLAYER_1;)
            let move = moves.find(move => move.from === from);
            if (move) {
                move.to = to;
            } else {
                moves.push({from, to});
            }
            return true;
        }
        return false;
    };






    const width = 100;
    const height = 100;

    const cells = createField(100, 100);
    const svg = d3.select('svg').attr('viewBox', `0 0 ${width} ${height}`);
    // const maxArea = Math.max(...cells.map(c => c.area));


    const executeMoves = () => {
        for (let move of moves) {
            if (move.from.control !== move.to.control) {
                const attacking = move.from.armies - 1;
                const defending = move.to.armies;
                move.from.armies = 1;
                move.to.armies = defending - attacking;
                if (move.to.armies < 0) {
                    move.to.control = userPlayer;
                    move.to.armies = -move.to.armies;
                }
            } else {
                move.to.armies += move.from.armies - 1;
                move.from.armies = 1;
            }
        }
        moves.length = 0;
    };

    const refillArmies = () => {
        cells.filter(cell => cell.control === userPlayer).forEach(cell => cell.armies += 10);
    };
    let mouseDownOn = null;
    let touchMoveOn = null;

    function redrawPolygon(polygon) {
        polygon
            .attr("d", function(d) { return "M" + d.polygon.join("L") + "Z" })
            .classed("player1", d => d.control === CONTROL.PLAYER_1)
            .classed("player2", d => d.control === CONTROL.PLAYER_2)
            // .on('mouseover', function() {
            //     d3.select(this).classed('hover', true)
            // })
            // .on('mouseout', function() {
            //     d3.select(this).classed('hover', false);
            // })
            .on('mousedown', cell => { mouseDownOn = cell; })
            .on('mouseup', cell => {
                if (mouseDownOn) {
                    if (addMove(mouseDownOn, cell)) {
                        redraw();
                    }
                }
                mouseDownOn = null;
            })
            .on('touchstart', cell => { mouseDownOn = cell; })
            .on('touchend', () => {
                if (mouseDownOn) {
                    const touch = d3.event.changedTouches[0];
                    const pathElement = document.elementsFromPoint(touch.clientX, touch.clientY)
                        .find(n => n.nodeName === 'path');
                    if (pathElement) {
                        const cell = d3.select(pathElement).datum();
                        if (addMove(mouseDownOn, cell)) {
                            redraw();
                        }
                        mouseDownOn = null;
                    }
                }
            })
            .on('click', function(a,b) { console.log(a) } )

    }

    function redraw() {
        svg.select(".polygons")
            .selectAll("path")
            .data(cells)
            .call(redrawPolygon);

        svg.select(".texts")
            .selectAll("text")
            .data(cells)
            .attr("x", d => d.center[0])
            .attr('y', d => d.center[1])
            .text(d => d.armies);

        svg.select(".moves")
            .selectAll("polyline")
            .data(moves)
            .enter()
            .append('polyline');

        svg.select(".moves")
            .selectAll("polyline")
            .data(moves)
            .exit()
            .remove();

        svg.select(".moves")
            .selectAll("polyline")
            .data(moves)
            .attr("points", d => `
                ${d.from.center[0]},${d.from.center[1]}
                ${d.to.center[0]},${d.to.center[1]}
            `)
            .attr('marker-end', "url(#arrow)")
    }

    svg.append("g")
        .attr("class", "polygons")
        .selectAll("path")
        .data(cells)
        .enter()
        .append('path');

    svg.append("g")
        .attr("class", "texts")
        .selectAll("text")
        .data(cells)
        .enter()
        .append("text");

    svg.append("g")
        .attr("class", "moves");

    redraw();

    // cells.for


    const wait = (time) => new Promise(resolve => window.setTimeout(resolve, time));

    window.startCounter = async () => {
        const setCounter = async (value) => {
            const counter = document.getElementById('counter');
            counter.classList.remove('fade');
            counter.innerHTML = ""+value;
            await wait(100);
            counter.classList.add('fade');
        };

        for (let i=5; i>=0; i--) {
            await wait(1000);
            setCounter(i);
        }
        executeMoves();
        refillArmies();
        redraw();
        startCounter();
    };




});

