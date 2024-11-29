// Include ECharts in your HTML file
// <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
// Function to fetch data from the endpoint
import * as echarts from "echarts";
import * as echartsgl from "echarts-gl";

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

    // Number of parameters (columns in the data)
    const numParameters = metadata.numParameters;

    // Transform data into nx6 format
    const reshapedData = [];
    for (let i = 0; i < data.length && i < 1000000; i += numParameters) {
      reshapedData.push(data.slice(i, i + numParameters));
    }

    // Apply log10 transformation to all channels except TIME (first channel)
    const transformedData = reshapedData.map((row) => {
      return row.map((value, index) => {
        return index === 0 ? value : Math.log10(value);
      });
    });

    // Extract specific channels for plotting
    const FL1 = transformedData.map((row) => row[2]); // FL1 is the third parameter (index 2)
    const FL2 = transformedData.map((row) => row[3]); // FL2 is the fourth parameter (index 3)
    const SSC = transformedData.map((row) => row[1]); // SSC is the second parameter (index 1)
    const FSC = transformedData.map((row) => row[4]); // FSC is the fifth parameter (index 4)

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
  const xEdges = Array.from(
    { length: bins + 1 },
    (_, i) => range[0] + (i * (range[1] - range[0])) / bins
  );
  const yEdges = Array.from(
    { length: bins + 1 },
    (_, i) => range[0] + (i * (range[1] - range[0])) / bins
  );

  const normalizedX = x.map(
    (val) => ((val - range[0]) / (range[1] - range[0])) * bins
  );
  const normalizedY = y.map(
    (val) => ((val - range[0]) / (range[1] - range[0])) * bins
  );

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

// Function to check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// Function to create a scatter plot with density coloring using ECharts
function plotScatterWithDensity(x, y, xLabel, yLabel, containerId, colormap) {
  const bins = 200;
  const viewerBins = 500;
  const range = [2, 6.7]; // Restrict the range to 2 to 6.7
  const { density } = calculateDensity(x, y, bins, range);

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

  const colormapColors = colorMaps[colormap] || colorMaps["Parula"];

  const polygon = [
    [4.2, 0],
    [4.2, 3.2],
    [6.7, 5.9],
    [6.7, 0.0],
  ];

  // Filter points within the restricted range
  const filteredPoints = x
    .map((val, i) => ({ x: x[i], y: y[i], density: density[i] }))
    .filter(
      (point) =>
        point.x >= 2 && point.x <= 6.7 && point.y >= 2 && point.y <= 6.7
    );

  filteredPoints.sort((a, b) => a.density - b.density);

  console.log(filteredPoints.length + " points");
  // Create a spatial grid
  const grid = new Map();
  const cellSize = (range[1] - range[0]) / viewerBins;

  const uniquePoints = [];
  filteredPoints.forEach((point) => {
    const xCell = Math.floor((point.x - range[0]) / cellSize);
    const yCell = Math.floor((point.y - range[0]) / cellSize);
    const cellKey = `${xCell},${yCell}`;

    // Only keep the first (highest-density) point for each cell
    if (!grid.has(cellKey)) {
      grid.set(cellKey, true);
      uniquePoints.push(point);
    }
  });

  const sortedX = uniquePoints.map((p) => p.x);
  const sortedY = uniquePoints.map((p) => p.y);
  const sortedDensity = uniquePoints.map((p) => p.density);

  console.log(uniquePoints.length + " points");

  // Filter points within the restricted range and the polygon
  const gatedPoints = x
    .map((val, i) => ({ x: x[i], y: y[i], density: density[i] }))
    .filter(
      (point) =>
        point.x >= 2 &&
        point.x <= 6.7 &&
        point.y >= 2 &&
        point.y <= 6.7 &&
        isPointInPolygon([point.x, point.y], polygon)
    );
  const sortedGatedX = gatedPoints.map((p) => p.x);
  const sortedGatedY = gatedPoints.map((p) => p.y);

  // Dispose of any existing chart instance
  const chartElement = document.getElementById(containerId);
  if (echarts.getInstanceByDom(chartElement)) {
    echarts.dispose(chartElement);
  }

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

  const chart = echarts.init(document.getElementById(containerId), "light", {}); // Use light theme

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
    series: [
      {
        type: "scatterGL",
        progressive: 0,
        symbolSize: 1.2,
        data: sortedX.map((val, i) => [
          sortedX[i],
          sortedY[i],
          sortedDensity[i],
        ]),
        itemStyle: {
          opacity: 1,
          color: function (params) {
            const value = params.data[2];
            const colorIndex = Math.min(
              Math.floor(value * (colormapColors.length - 1)),
              colormapColors.length - 1
            );
            return colormapColors[colorIndex];
          },
        },
      },
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
      },
    ],
    tooltip: {
      show: false,
    },
    animation: false,
  };

  chart.setOption(option);
}

// Initialize the plot
initializePlot();
