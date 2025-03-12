document.addEventListener("DOMContentLoaded", function() {
    var firstRow = document.querySelector("tr:first-child");
    var firstRowHeight = firstRow.offsetHeight;
    document.documentElement.style.setProperty('--first-row-height', firstRowHeight + 'px');
});