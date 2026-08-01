(function ($) {

    $(".atbd-accordion").on("click",".atbd-collapse-item__header", function (e) {
        e.stopPropagation();
        const collapseElement = this.nextElementSibling;
        if (collapseElement) {
            const collapse = new bootstrap.Collapse(collapseElement, { show: true });
        }
        // Hide other collapse elements
        const otherCollapses = this.parentElement.parentElement.querySelectorAll(".atbd-collapse-item__body");
        otherCollapses.forEach(el => {
            if (el !== this.nextElementSibling) {
                const collapse = new bootstrap.Collapse(el, { show: false });
            }
        });
    });

    $(".atbd-collapse").on("click",".atbd-collapse-item__header", function (e) {
        $(this).toggleClass("active")
    });


})(jQuery);