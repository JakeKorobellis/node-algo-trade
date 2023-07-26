//Grabbing Elements
const quotesElem = document.getElementById("quotes");
const tradesElem = document.getElementById("trades");
const barsElem = document.getElementById("bars");
//Varaibles for live updates
//currBar gets updated based on trades that are comming through
let currBar = {};
let trades = [];

//Light weight chart varibales
let chart = LightweightCharts.createChart(document.getElementById("bars"), {
  width: 1000,
  height: 400,
  crosshair: {
    mode: LightweightCharts.CrosshairMode.Normal,
  },
  layout: {
    background: { color: "#000000" },
    textColor: "#ffffff",
  },
  grid: {
    vertLines: {
      color: "#404040",
    },
    horzLines: {
      color: "#404040",
    },
  },
  priceScale: {
    borderColor: "#cccccc",
  },
  timeScale: {
    borderColor: "#cccccc",
    timeVisible: true,
  },
});

let candleSeries = chart.addCandlestickSeries();

//Connect to websocket, send / recieve messages
const url = "wss://stream.data.alpaca.markets/v1beta2/crypto";
const socket = new WebSocket(url);
//auth details
const authDetails = {
  action: "auth",
  key: "PKO65T37FBWDOLMLMX3O",
  secret: "pcYL0SKXZglsKLSxDgQ8vbnAoR7PgctPibNRlmhj",
};
//Data to subscirbe too
const subData = {
  action: "subscribe",
  trades: ["ETH/USD"],
  quotes: ["ETH/USD"],
  bars: ["ETH/USD"],
};

//get historical data to fill the chart
const start = new Date(Date.now() - 7200 * 10000).toISOString();
const barsURL =
  "https://data.alpaca.markets/v1beta1/crypto/ETHUSD/bars?exchanges=CBSE&timeframe=1Min&start=" +
  start;

//fetch historical data for chart
fetch(barsURL, {
  headers: {
    "APCA-API-KEY-ID": "PKO65T37FBWDOLMLMX3O",
    "APCA-API-SECRET-KEY": "pcYL0SKXZglsKLSxDgQ8vbnAoR7PgctPibNRlmhj",
  },
})
  .then((r) => r.json())
  .then((response) => {
    console.log(response);

    let data = response.bars.map((curr) => ({
      open: curr.o,
      high: curr.h,
      low: curr.l,
      close: curr.c,
      time: Date.parse(curr.t) / 1000,
    }));

    currBar = data[data.length - 1];
    console.log(data);

    //set data to chart
    candleSeries.setData(data);
  });

socket.onmessage = (event) => {
  const checkConnection = JSON.parse(event.data);
  const dataMsg = checkConnection[0]["msg"];

  //Attempt connection
  if (dataMsg == "connected") {
    console.log("Authenticating...");
    socket.send(JSON.stringify(authDetails));
  }
  //Check connection && Subscribe to Data
  if (dataMsg == "authenticated") {
    console.log("Authenticated!, getting data.");
    socket.send(JSON.stringify(subData));
  }

  //loop through array of data that is being returned
  for (let quote in checkConnection) {
    //Check type ( T ) of quote coming in
    const type = checkConnection[quote].T;
    switch (type) {
      case "q":
        //  console.log("Got a quote");
        //  console.log(checkConnection[quote]);
        //DOM Manip to append data
        const quoteElement = document.createElement("div");
        quoteElement.innerHTML = `<div>${formatTime(
          checkConnection[quote].t
        )}</div> <div>${checkConnection[quote].bp}</div><div> ${
          checkConnection[quote].ap
        } </div>`;
        quoteElement.classList.add("quote-render");
        quotesElem.appendChild(quoteElement);

        //check the length of the element, if greater than 10 we remove the last element
        var lengthCheck = document.getElementsByClassName("quote-render");
        if (lengthCheck.length > 10) {
          //remove first elem as that is the oldest
          quotesElem.removeChild(lengthCheck[0]);
        }
        break;
      case "t":
        //  console.log("Got a Trade");
        //  console.log(checkConnection[quote]);
        //DOM Manip to append data
        const tradeElement = document.createElement("div");
        tradeElement.innerHTML = `<div>${formatTime(
          checkConnection[quote].t
        )}</div> <div>${
          Math.round(checkConnection[quote].s * 1000) / 1000
        }</div><div> ${Math.round(checkConnection[quote].p * 100) / 100}</div>`;
        tradeElement.classList.add("trade-render");
        tradesElem.appendChild(tradeElement);

        //check the length of the element, if greater than 10 we remove the last element
        var lengthCheck = document.getElementsByClassName("trade-render");
        if (lengthCheck.length > 10) {
          //remove first elem as that is the oldest
          tradesElem.removeChild(lengthCheck[0]);

          //update trades array to show live bar movement
          trades.push(checkConnection[quote].p);

          //first price in trades will be open price of bar
          let openBar = trades[0];
          //last || latestes price will be most recent bar inputted
          let closeBar = trades[trades.length - 1];
          //High of bar
          let highBar = Math.max(...trades);
          //Low of bar
          let lowBar = Math.min(...trades);
          //update chart
          candleSeries.update({
            time: currBar.time + 60, //adding 60 seconds to the previous bar
            open: openBar,
            high: highBar,
            low: lowBar,
            close: closeBar,
          });
        }

        break;
      case "b":
        console.log("Got a bar");
        console.log(checkConnection[quote]);
        //convert to unix
        let bar = checkConnection[quote];
        let convertedTime = new Date(bar.t).getTime() / 1000;
        //append new bars coming in to currBar
        currBar = {
          time: convertedTime,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
        };
        //update candle series
        candleSeries.update(currBar);
        //reset trades array to continue updating bars live
        trades = [];
        break;
    }
  }
};

//format time to readable EST time
function formatTime(dateTimeString) {
  const dateTime = new Date(dateTimeString);
  dateTime.setUTCHours(dateTime.getUTCHours()); // convert to EST
  let hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  const amOrPm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12; // convert 0 to 12
  const formattedTime = `${hours}:${minutes
    .toString()
    .padStart(2, "0")}${amOrPm} EST`;
  return formattedTime;
}
