import { nest } from 'd3-collection'
import { sum, min, ascending } from 'd3-array'
import { interpolateNumber } from 'd3-interpolate'
import { CubicBezierCurve, Vector2, Points, PointsMaterial, BufferAttribute, BufferGeometry, LineBasicMaterial, Line, LineSegments } from 'three'
import { TweenLite } from 'gsap'

export default function () {
  var sankey = {},
    nodeWidth = 24,
    nodePadding = 8,
    size = [1, 1],
    nodes = [],
    links = [];

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };
  
  function getAdjustedXCoordinate (x) {
    return x - (size[0] / 2)
  }

  function getAdjustedYCoordinate (y) {
    return y - (size[1] / 2)
  }

  sankey.link = function (d, value, scene) {
    var starsMaterial = new PointsMaterial({color: 0xff0000, size: 1})
    var geometry = new BufferGeometry()
    geometry.addAttribute('position', new BufferAttribute( new Float32Array( value * 2 ), 2))
    scene.add(new Points(geometry, starsMaterial))
    const positions = geometry.attributes.position
    const positionArray = positions.array
    const x0 = getAdjustedXCoordinate(d.source.x)
    const x1 = getAdjustedXCoordinate(d.target.x) + (Math.random() * 2)
    let index = 0
    for (let i = 0; i < value; i++) {
      const y1 = getAdjustedYCoordinate(d.target.y + d.ty + (Math.random() * d.dy))
      const y0 = getAdjustedYCoordinate(d.source.y + d.sy + (Math.random() * d.dy))
      const thisIndex = index
      positionArray[index++] = x0 + (Math.random() * d.source.dx)
      positionArray[index++] = y0
      const coordinates = {x: x0, y: y0}
      TweenLite.to(coordinates, 1 + (5 * Math.random()), {
        x: x1,
        y: y1,
        delay: 2 + Math.random() * 30,
        onUpdate: () => {
          positionArray[thisIndex] = coordinates.x
          positionArray[thisIndex + 1] = coordinates.y
          positions.needsUpdate = true
        },
        onComplete: () => {
          const shuffledIndices = shuffle(d.target.sourceLinks.map((d, i) => i), d.target.sourceLinks.map(d => d.value))
          for (let i = 0; i < d.target.sourceLinks.length; i++) {
            if (d.target.sourceLinks[shuffledIndices[i]].value > 0) {
              d.target.sourceLinks[shuffledIndices[i]].value--
              movePointTo(positions, thisIndex, d.target.sourceLinks[shuffledIndices[i]])
              break
            }
          }
        }
      })
    }
  }

  // shuffle the array (https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array)
  function shuffle (a, d) {
    if (!d.length) { return }

    let j, x, i
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1))
      x = a[i]
      a[i] = a[j]
      a[j] = x
    }
    return a
    //debugger
    const sum = d.reduce((x, y) => x + y)
    let randomNum = Math.random()
    const picked = []
    const passed = []
    for (let i = 0; i < d.length; i++) {
      if (randomNum < (d[a[i]] / sum)) {
        picked.push(a[i])
        randomNum = Math.random()
      } else {
        passed.push(a[i])
      }
    }
    //console.log([...picked, ...passed])
    return [...picked, ...passed]
  }

  function movePointTo (positions, currentIndex, link) {
    const positionArray = positions.array
    const nextX = getAdjustedXCoordinate(link.target.x) + (Math.random() * link.source.dx)
    const nextY = getAdjustedYCoordinate(link.target.y + link.ty + (Math.random() * link.dy))
    const currentCoordinates = {x: positionArray[currentIndex], y: positionArray[currentIndex + 1]}
    TweenLite.to(currentCoordinates, 1 + (20 * Math.random()), {
      x: nextX,
      y: nextY,
      ease: Cubic.easeInOut,
      onUpdate: () => {
        positionArray[currentIndex] = currentCoordinates.x
        positionArray[currentIndex + 1] = currentCoordinates.y
        positions.needsUpdate = true
      },
      onComplete: () => {

        const shuffledIndices = shuffle(link.target.sourceLinks.map((d, i) => i), link.target.sourceLinks.map(d => d.value))
        for (let i = 0; i < link.target.sourceLinks.length; i++) {
          if (link.target.sourceLinks[shuffledIndices[i]].value > 0) {
            link.target.sourceLinks[shuffledIndices[i]].value--
            movePointTo(positions, currentIndex, link.target.sourceLinks[shuffledIndices[i]])
            break
          }
        }
      }
    })
  }

  sankey.initiate = function (scene) {
    const points = createPoints(scene)

    const positions = points.geometry.attributes.position.array
    let index = 0
  }

  function createPoints (scene) {
    let totalSourceValue = 0
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].targetLinks.length) {
        totalSourceValue = totalSourceValue + nodes[i].value
      }
    }
    var material = new PointsMaterial({color: 0xff0000, size: 1})
    var geometry = new BufferGeometry()
    geometry.addAttribute('position', new BufferAttribute(new Float32Array(totalSourceValue * 2), 2))
    const points = new Points(geometry, material)
    scene.add(points)
    return points
  }

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        sum(node.sourceLinks, value),
        sum(node.targetLinks, value)
      );
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          nextNodes.push(link.target);
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }

    //
    //moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1))
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = nest()
        .key(function(d) { return d.x; })
        .sortKeys(ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var ky = min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = sum(node.targetLinks, weightedSource) / sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = sum(node.sourceLinks, weightedTarget) / sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
}
