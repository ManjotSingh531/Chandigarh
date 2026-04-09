
(function($) {

	skel.init({
		reset: 'full',
		breakpoints: {
			
			// Global.
				global: {
					range: '*',
					href: 'css/style.css',
					containers: 1400,
					grid: {
						gutters: {
							vertical: '4em',
							horizontal: 0
						}
					}
				},

			// XLarge.
				xlarge: {
					range: '-1680',
					href: 'css/style-xlarge.css',
					containers: 1200
				},

			// Large.
				large: {
					range: '-1280',
					href: 'css/style-large.css',
					containers: 960,
					grid: {
						gutters: {
							vertical: '2.5em'
						}
					},
					viewport: {
						scalable: false
					}
				},

			// Medium.
				medium: {
					range: '-980',
					href: 'css/style-medium.css',
					containers: '90%',
					grid: {
						collapse: 1
					}
				},

			// Small.
				small: {
					range: '-736',
					href: 'css/style-small.css',
					containers: '90%',
					grid: {
						gutters: {
							vertical: '1.25em'
						}
					}
				},

			// XSmall.
				xsmall: {
					range: '-480',
					href: 'css/style-xsmall.css',
					grid: {
						collapse: 2
					}
				}

		},
		plugins: {
			layers: {
				
				// Config.
					config: {
						transform: true
					},
				
				// Navigation Panel.
					navPanel: {
						animation: 'pushX',
						breakpoints: 'medium',
						clickToHide: true,
						height: '100%',
						hidden: true,
						html: '<div data-action="moveElement" data-args="nav"></div>',
						orientation: 'vertical',
						position: 'top-left',
						side: 'left',
						width: 250
					},

				// Navigation Button.
					navButton: {
						breakpoints: 'medium',
						height: '4em',
						html: '<span class="toggle" data-action="toggleLayer" data-args="navPanel"></span>',
						position: 'top-left',
						side: 'top',
						width: '6em'
					}

			}
		}
	});

	$(function() {
		function initGlobalScrollReveal() {
			var targets = [];
			var seen = new Set();
			var allowMotion = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			function addTarget(element) {
				if (!element || seen.has(element))
					return;
				if (element.closest('#header, #footer'))
					return;
				seen.add(element);
				targets.push(element);
			}

			addTarget(document.querySelector('#banner .inner'));

			document.querySelectorAll('section.wrapper').forEach(function(section) {
				addTarget(section.querySelector('header.major'));
				addTarget(section.querySelector('.container'));
				section.querySelectorAll('.row > div, section.special, article.special, table, form').forEach(addTarget);
			});

			if (!targets.length)
				return;

			targets.forEach(function(target, index) {
				target.classList.add('scroll-fade-up');
				target.classList.add('scroll-delay-' + (index % 4));
			});

			if (!allowMotion || !('IntersectionObserver' in window)) {
				targets.forEach(function(target) {
					target.classList.add('is-visible');
				});
				return;
			}

			var observer = new IntersectionObserver(function(entries) {
				entries.forEach(function(entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-visible');
						observer.unobserve(entry.target);
					}
				});
			}, {
				threshold: 0.16,
				rootMargin: '0px 0px -40px 0px'
			});

			targets.forEach(function(target) {
				observer.observe(target);
			});
		}

		initGlobalScrollReveal();
		
	});

})(jQuery);
