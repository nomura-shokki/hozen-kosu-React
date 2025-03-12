const ctx = document.querySelector('#chart');
const chart = new Chart(ctx, {
    type: 'bar',
    plugins : [
        ChartDataLabels,
    ],
    data: {
        labels: label_list,
        datasets: [{
        label: false,
        data: data_list,
        backgroundColor: c_list 
        }]
    },

    options: {
        plugins: {
        datalabels: {
            font: {
            size: 10,
            },
            formatter : function(value, context){
            return  value.toString();
            }
        },
        legend: {
            display: false,
        },
        },
    }})