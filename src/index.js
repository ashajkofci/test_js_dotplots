// Include ECharts in your HTML file
// <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
// Function to fetch data from the endpoint
import * as echarts from "echarts";
//import * as echartsgl from "echarts-gl";

async function fetchData(url, token) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return response.json();
}

// Main function to initialize and plot the data
async function initializePlot() {
  const url =
    "https://apitest.bactocloud.com/data/fcs/673816ca06e0eb8afdd9c63a";
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySUQiOiI2NmNmNjVkM2ZhMmFmOTk5MTcxYmMwZTIiLCJleHAiOjE3NDcwNzQxOTB9.f_1PZQ0OOhQ1ufsB0NPg63GunW2bJWu-6ljm90yuJjI";

  try {
    const dataObject = await fetchData(url, token);

    const metadata = dataObject.metadata;
    const data = dataObject.data;

    // 30 ms => optimized
    console.log("Reshape Data");

    const numParameters = metadata.numParameters;
    const maxDataPoints = 1500000;

    const numPoints = Math.min(
      data.length / numParameters,
      maxDataPoints / numParameters
    );

    const FL1 = new Float32Array(numPoints);
    const FL2 = new Float32Array(numPoints);
    const SSC = new Float32Array(numPoints);
    const FSC = new Float32Array(numPoints);

    for (let i = 0; i < numPoints; i++) {
      const baseIndex = i * numParameters;

      SSC[i] = Math.log10(data[baseIndex + 1]);
      FL1[i] = Math.log10(data[baseIndex + 2]);
      FL2[i] = Math.log10(data[baseIndex + 3]);
      FSC[i] = Math.log10(data[baseIndex + 4]);
    }

    console.log("Reshape Data");

    // Initialize default plot
    plotScatterWithDensity(
      FL1,
      FL2,
      "FL1 (log10)",
      "FL2 (log10)",
      "scatter-plot",
      "Parula"
    );

    // Set up button event listeners for switching between plots
    document.getElementById("btn-fl1-fl2").addEventListener("click", () => {
      plotScatterWithDensity(
        FL1,
        FL2,
        "FL1 (log10)",
        "FL2 (log10)",
        "scatter-plot",
        "Parula"
      );
    });

    document.getElementById("btn-fl1-ssc").addEventListener("click", () => {
      plotScatterWithDensity(
        FL1,
        SSC,
        "FL1 (log10)",
        "SSC (log10)",
        "scatter-plot",
        "Plasma"
      );
    });

    document.getElementById("btn-ssc-fsc").addEventListener("click", () => {
      plotScatterWithDensity(
        SSC,
        FSC,
        "SSC (log10)",
        "FSC (log10)",
        "scatter-plot",
        "Inferno"
      );
    });

    // Set up reset zoom button
    document.getElementById("btn-reset-zoom").addEventListener("click", () => {
      const chartElement = document.getElementById("scatter-plot");
      const chart = echarts.getInstanceByDom(chartElement);
      if (chart) {
        chart.dispatchAction({
          type: "dataZoom",
          start: 0,
          end: 100,
        });
      }
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to calculate 2D histogram density
function calculateDensity(x, y, bins, range) {
  const normalizedX = x.map(
    (val) => ((val - range[0]) / (range[1] - range[0])) * bins
  );
  const normalizedY = y.map(
    (val) => ((val - range[0]) / (range[1] - range[0])) * bins
  );
  // this could be optimized away by allocating it only once (bins do not change)
  const histogram = Array.from({ length: bins }, () => Array(bins).fill(0));

  for (let i = 0; i < x.length; i++) {
    const xIndex = Math.floor(normalizedX[i]);
    const yIndex = Math.floor(normalizedY[i]);
    if (xIndex >= 0 && xIndex < bins && yIndex >= 0 && yIndex < bins) {
      histogram[xIndex][yIndex]++;
    }
  }

  const maxDensity = Math.max(...histogram.flat());

  return {
    density: x.map((_, i) => {
      const xIndex = Math.floor(normalizedX[i]);
      const yIndex = Math.floor(normalizedY[i]);
      return xIndex >= 0 && xIndex < bins && yIndex >= 0 && yIndex < bins
        ? histogram[xIndex][yIndex] / maxDensity
        : 0;
    }),
    histogram: histogram,
  };
}

// Preprocess polygon to compute slopes and bounding box
function preprocessPolygon(polygon) {
  const edges = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    edges.push({
      xi,
      yi,
      xj,
      yj,
      slope: (xj - xi) / (yj - yi), // Precompute slope
    });

    // Update bounding box
    minX = Math.min(minX, xi);
    minY = Math.min(minY, yi);
    maxX = Math.max(maxX, xi);
    maxY = Math.max(maxY, yi);
  }

  return { edges, boundingBox: { minX, minY, maxX, maxY } };
}

// Optimized function to check if a point is inside a polygon
function isPointInPolygon(point, preprocessedPolygon) {
  const [px, py] = point;
  const { edges, boundingBox } = preprocessedPolygon;

  // Quick bounding box check
  if (
    px < boundingBox.minX ||
    px > boundingBox.maxX ||
    py < boundingBox.minY ||
    py > boundingBox.maxY
  ) {
    return false;
  }

  // Ray-casting algorithm
  let inside = false;
  for (const { xi, yi, xj, yj, slope } of edges) {
    const intersect = yi > py !== yj > py && px < slope * (py - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}
const colorMaps = {
  Parula: [
    "#352a87",
    "#0363e1",
    "#1485d4",
    "#06a7c6",
    "#38b99e",
    "#92bf73",
    "#d9ba56",
    "#fcce2e",
    "#f9fb0e",
  ],
  Plasma: [
    "#0D0887",
    "#46039F",
    "#7201A8",
    "#9C179E",
    "#BD3786",
    "#D8576B",
    "#ED7953",
    "#FB9F3A",
    "#F0F921",
  ],
  Inferno: [
    "#000004",
    "#1B0C41",
    "#4A0C6B",
    "#781C6D",
    "#A52C60",
    "#CF4446",
    "#ED6925",
    "#FB9A06",
    "#FCFFA4",
  ],
};

const bins = 225;
const viewerBins = 430;
const densityBins = 9;
const binSize = 1 / densityBins;
// Precompute constants
const grid = new Array(viewerBins * viewerBins).fill(false);
const gridWidth = viewerBins;

// Function to create a scatter plot with density coloring using ECharts
function plotScatterWithDensity(x, y, xLabel, yLabel, containerId, colormap) {
  const range = [2, 6.7]; // Restrict the range to 2 to 6.7

  // 35 ms
  console.log("Calculate Density");
  const { density } = calculateDensity(x, y, bins, range);
  console.log("Calculate Density");

  const colormapColors = colorMaps[colormap] || colorMaps["Parula"];

  const polygon = [
    [4.2, 0],
    [4.2, 3.2],
    [6.7, 5.9],
    [6.7, 0.0],
  ];

  // Allocate memory
  const filteredPoints = [];
  const uniquePoints = [];

  // 1ms
  console.log("preprocess gate");
  const preprocessedPolygon = preprocessPolygon(polygon);
  console.log("preprocess gate");

  // 10 ms => optimized
  console.log("Filter points outside of range");
  // Filter points within the restricted range
  const lowerBound = range[0];
  const upperBound = range[1];

  for (let i = 0; i < x.length; i++) {
    const xVal = x[i];
    const yVal = y[i];
    const densityVal = density[i];

    // Inline filtering
    if (
      xVal >= lowerBound &&
      xVal <= upperBound &&
      yVal >= lowerBound &&
      yVal <= upperBound
    ) {
      filteredPoints.push({ x: xVal, y: yVal, density: densityVal });
    }
  }
  console.log("Filter points outside of range");

  // We do not need to sort by density

  console.log("Before processing: " + filteredPoints.length + " points");
  // 10 ms => already optimized
  console.log("Filter points that are under higher density points");

  const inverseCellSize = viewerBins / (range[1] - range[0]);
  // Reset grid (initialized outside)
  grid.fill(false);

  filteredPoints.forEach((point) => {
    // Compute cell indices
    const xCell = Math.floor((point.x - range[0]) * inverseCellSize);
    const yCell = Math.floor((point.y - range[0]) * inverseCellSize);
    const cellIndex = yCell * gridWidth + xCell;

    // Only keep the first (highest-density) point for each cell
    if (!grid[cellIndex]) {
      grid[cellIndex] = true;
      uniquePoints.push(point);
    }
  });
  console.log("Filter points that are under higher density points");
  console.log("After processing: " + uniquePoints.length + " points");

  // 5ms
  console.log("Create series");

  const seriesData = Array.from({ length: densityBins }, () => []);

  uniquePoints.forEach((point) => {
    const binIndex = Math.min(
      Math.floor(point.density / binSize),
      densityBins - 1
    );
    seriesData[binIndex].push([point.x, point.y]);
  });
  console.log("Create series");

  // GATING PART (30ms) => already optimized
  console.log("Gating");
  const sortedGatedX = [];
  const sortedGatedY = [];

  for (let i = 0; i < filteredPoints.length; i++) {
    if (
      isPointInPolygon(
        [filteredPoints[i].x, filteredPoints[i].y],
        preprocessedPolygon
      )
    ) {
      sortedGatedX.push(filteredPoints[i].x);
      sortedGatedY.push(filteredPoints[i].y);
    }
  }

  console.log("Gating");

  // 1D Histograms (10 ms)
  console.log("1D histograms");
  const xHistogram = sortedGatedX.reduce((acc, val) => {
    const bin = Math.floor(((val - range[0]) / (range[1] - range[0])) * bins);
    acc[bin] = (acc[bin] || 0) + 1;
    return acc;
  }, Array(bins).fill(0));

  const yHistogram = sortedGatedY.reduce((acc, val) => {
    const bin = Math.floor(((val - range[0]) / (range[1] - range[0])) * bins);
    acc[bin] = (acc[bin] || 0) + 1;
    return acc;
  }, Array(bins).fill(0));
  console.log("1D histograms");

  // Create chart 5ms
  console.log("Create chart");
  // Dispose of any existing chart instance
  const chartElement = document.getElementById(containerId);
  if (echarts.getInstanceByDom(chartElement)) {
    echarts.dispose(chartElement);
  }
  const chart = echarts.init(document.getElementById(containerId), "light", {}); // Use light theme
  console.log("Create chart");

  const scatterSeries = seriesData.map((data, index) => ({
    type: "scatter",
    data,
    symbolSize: 1.2,
    progressive: 0,
    large: true,
    itemStyle: {
      opacity: 1.0,
      color: colormapColors[index],
    },
  }));
  scatterSeries.push(
    {
      type: "bar",
      xAxisIndex: 1,
      barCategoryGap: "-100%",
      yAxisIndex: 1,
      data: xHistogram,
      itemStyle: {
        color: "#0363e1",
      },
      large: true,
    },
    {
      type: "bar",
      xAxisIndex: 2,
      barCategoryGap: "-100%",
      yAxisIndex: 2,
      data: yHistogram,
      itemStyle: {
        color: "#0363e1",
      },
      large: true,
    },
    {
      type: "line",
      data: polygon,
      lineStyle: {
        color: "red",
        width: 3,
      },
      areaStyle: {
        color: "rgba(255, 0, 0, 0.0)",
      },
      showSymbol: false,
    }
  );

  const option = {
    title: {
      text: `${xLabel} vs ${yLabel}`,
    },
    grid: [
      { left: "10%", right: "25%", top: "10%", bottom: "26%" }, // Main grid
      { left: "10%", right: "25%", height: "10%", bottom: "10%" }, // Y-axis histogram grid
      { right: "10%", bottom: "26%", width: "10%" }, // X-axis histogram grid
    ],
    xAxis: [
      {
        name: xLabel,
        min: 2,
        max: 6.8,
        nameLocation: "center",
        nameTextStyle: {
          padding: 8,
        },
      },
      {
        type: "category",
        gridIndex: 1,
        boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      {
        nameLocation: "center",
        nameTextStyle: {
          padding: -10,
        },
        scale: true,
        gridIndex: 2,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        position: "top",
      },
    ],
    yAxis: [
      {
        name: yLabel,
        min: 2,
        max: 6.8,
        nameLocation: "center",
        nameTextStyle: {
          padding: 8,
        },
      },
      {
        scale: true,
        name: "#",
        nameLocation: "center",
        nameTextStyle: {
          padding: 15,
        },
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: true },
        axisLine: { show: true },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      {
        type: "category",
        gridIndex: 2,
        boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
    ],
    series: scatterSeries,
    tooltip: {
      show: false,
    },
    animation: false,
  };

  chart.setOption(option);
}

// Initialize the plot
initializePlot();
