/*
 * FlyBox - jQuery Plugin
 *
 * Copyright (c) 2008 - 2010 Janis Skarnelis
 * That said, it is hardly a one-person project. Many people have submitted bugs, code, and offered their advice freely. Their support is greatly appreciated.
 * Copyright (c) 2013 - 2015 Nikita Skovoroda
 *
 * Version: 0.1
 * Requires: jQuery v1.3+ (TODO: check version requirements)
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

;(function($) {
	var	tmp, loading, overlay, wrap, outer, content, close, title, nav_left, nav_right,
		selectedIndex = 0, selectedOpts = {}, selectedArray = [], currentIndex = 0, currentOpts = {}, currentArray = [],
		ajaxLoader = null, imgPreloader = new Image(),
		loadingTimer, loadingFrame = 1,
		titleHeight = 0, titleStr = '', start_pos, final_pos, busy = false, fx = $.extend($('<div/>')[0], { prop: 0 });

	var _abort = function() {
		loading.hide();
		imgPreloader.onerror = imgPreloader.onload = null;
		if (ajaxLoader) {
			ajaxLoader.abort();
		}
		tmp.empty();
	};

	var _error = function() {
		if (false === selectedOpts.onError(selectedArray, selectedIndex, selectedOpts)) {
			loading.hide();
			busy = false;
			return;
		}
		selectedOpts.titleShow = false;
		selectedOpts.width = 'auto';
		selectedOpts.height = 'auto';
		tmp.html('<p id="flybox-error">The requested content cannot be loaded.<br />Please try again later.</p>');
		_process_inline();
	};

	var _start = function() {
		var	obj = selectedArray[selectedIndex],
			href, type, title, ret;
		_abort();

		selectedOpts = $.extend({}, $.fn.flybox.defaults, (typeof $(obj).data('flybox') == 'undefined' ? selectedOpts : $(obj).data('flybox')));

		ret = selectedOpts.onStart(selectedArray, selectedIndex, selectedOpts);

		if (ret === false) {
			busy = false;
			return;
		} else if (typeof ret == 'object') {
			selectedOpts = $.extend(selectedOpts, ret);
		}

		title = selectedOpts.title || (obj.nodeName ? $(obj).attr('title') : obj.title) || '';

		if (obj.nodeName && !selectedOpts.orig) {
			selectedOpts.orig = $(obj).children("img:first").length ? $(obj).children("img:first") : $(obj);
		}

		if (title === '' && selectedOpts.orig && selectedOpts.titleFromAlt) {
			title = selectedOpts.orig.attr('alt');
		}

		href = selectedOpts.href || (obj.nodeName ? $(obj).attr('href') : obj.href) || null;

		if ((/^(?:javascript)/i).test(href) || href == '#') {
			href = null;
		}

		if (selectedOpts.type) {
			type = selectedOpts.type;
			if (!href) {
				href = selectedOpts.content;
			}
		} else if (selectedOpts.content) {
			type = 'html';
		} else if (href) {
			if (href.match(selectedOpts.imageRegExp)) {
				type = 'image';
			} else if ($(obj).hasClass("iframe")) {
				type = 'iframe';
			} else if (href.indexOf("#") === 0) {
				type = 'inline';
			} else {
				type = 'ajax';
			}
		}

		if (!type) {
			_error();
			return;
		}

		if (type == 'inline') {
			obj	= href.substr(href.indexOf("#"));
			type = $(obj).length > 0 ? 'inline' : 'ajax';
		}

		selectedOpts.type = type;
		selectedOpts.href = href;
		selectedOpts.title = title;

		if (selectedOpts.autoDimensions) {
			if (selectedOpts.type == 'html' || selectedOpts.type == 'inline' || selectedOpts.type == 'ajax') {
				selectedOpts.width = 'auto';
				selectedOpts.height = 'auto';
			} else {
				selectedOpts.autoDimensions = false;
			}
		}

		if (selectedOpts.modal) {
			selectedOpts.overlayShow = true;
			selectedOpts.hideOnOverlayClick = false;
			selectedOpts.hideOnContentClick = false;
			selectedOpts.enableEscapeButton = false;
			selectedOpts.showCloseButton = false;
		}

		selectedOpts.padding = parseInt(selectedOpts.padding, 10);
		selectedOpts.margin = parseInt(selectedOpts.margin, 10);

		tmp.css('padding', (selectedOpts.padding + selectedOpts.margin));

		$('.flybox-inline-tmp').unbind('flybox-cancel').bind('flybox-change', function() {
			$(this).replaceWith(content.children());
		});

		switch (type) {
			case 'html' :
				tmp.html( selectedOpts.content );
				_process_inline();
				break;
			case 'inline' :
				if ( $(obj).parent().is('#flybox-content') === true) {
					busy = false;
					return;
				}
				$('<div class="flybox-inline-tmp" />')
					.hide()
					.insertBefore( $(obj) )
					.bind('flybox-cleanup', function() {
						$(this).replaceWith(content.children());
					}).bind('flybox-cancel', function() {
						$(this).replaceWith(tmp.children());
					});
				$(obj).appendTo(tmp);
				_process_inline();
				break;
			case 'image':
				busy = false;
				$.flybox.showActivity();
				imgPreloader = new Image();
				imgPreloader.onerror = function() {
					_error();
				};
				imgPreloader.onload = function() {
					busy = true;
					imgPreloader.onerror = imgPreloader.onload = null;
					_process_image();
				};
				imgPreloader.src = href;
				break;

			case 'ajax':
				busy = false;

				$.flybox.showActivity();

				selectedOpts.ajax.win = selectedOpts.ajax.success;

				ajaxLoader = $.ajax($.extend({}, selectedOpts.ajax, {
					url	: href,
					data : selectedOpts.ajax.data || {},
					error : function(XMLHttpRequest, textStatus, errorThrown) {
						if ( XMLHttpRequest.status > 0 ) {
							_error();
						}
					},
					success : function(data, textStatus, XMLHttpRequest) {
						var o = typeof XMLHttpRequest == 'object' ? XMLHttpRequest : ajaxLoader;
						if (o.status == 200) {
							if ( typeof selectedOpts.ajax.win == 'function' ) {
								ret = selectedOpts.ajax.win(href, data, textStatus, XMLHttpRequest);

								if (ret === false) {
									loading.hide();
									return;
								} else if (typeof ret == 'string' || typeof ret == 'object') {
									data = ret;
								}
							}

							tmp.html( data );
							_process_inline();
						}
					}
				}));

			break;

			case 'iframe':
				_show();
			break;
		}
	};

	var _process_inline = function() {
		var	w = selectedOpts.width,
			h = selectedOpts.height;

		if (w.toString().indexOf('%') > -1) {
			w = parseInt(($(window).width() - (selectedOpts.margin * 2)) * parseFloat(w) / 100, 10) + 'px';
		} else {
			w = w == 'auto' ? 'auto' : w + 'px';
		}

		if (h.toString().indexOf('%') > -1) {
			h = parseInt(($(window).height() - (selectedOpts.margin * 2)) * parseFloat(h) / 100, 10) + 'px';
		} else {
			h = h == 'auto' ? 'auto' : h + 'px';
		}

		tmp.wrapInner('<div style="width:' + w + ';height:' + h + ';overflow: ' + (selectedOpts.scrolling == 'auto' ? 'auto' : (selectedOpts.scrolling == 'yes' ? 'scroll' : 'hidden')) + ';position:relative;"></div>');

		selectedOpts.width = tmp.width();
		selectedOpts.height = tmp.height();

		_show();
	};

	var _process_image = function() {
		selectedOpts.width = imgPreloader.width;
		selectedOpts.height = imgPreloader.height;

		$("<img />").attr({
			'id' : 'flybox-img',
			'src' : imgPreloader.src,
			'alt' : selectedOpts.title
		}).appendTo( tmp );

		_show();
	};

	var _show = function() {
		loading.hide();

		if (wrap.is(":visible") && false === currentOpts.onCleanup(currentArray, currentIndex, currentOpts)) {
			$.event.trigger('flybox-cancel');
			busy = false;
			return;
		}

		busy = true;

		$(content.add( overlay )).unbind();

		$(window).unbind("resize.fb scroll.fb");
		$(document).unbind('keydown.fb');

		if (wrap.is(":visible") && currentOpts.titlePosition !== 'outside') {
			wrap.css('height', wrap.height());
		}

		currentArray = selectedArray;
		currentIndex = selectedIndex;
		currentOpts = selectedOpts;

		if (currentOpts.overlayShow) {
			overlay.css({
				'background-color' : currentOpts.overlayColor,
				'opacity' : currentOpts.overlayOpacity,
				'cursor' : currentOpts.hideOnOverlayClick ? 'pointer' : 'auto',
				'height' : $(document).height()
			});

			if (!overlay.is(':visible')) {
				overlay.show();
			}
		} else {
			overlay.hide();
		}

		final_pos = _get_zoom_to();

		_process_title();

		if (wrap.is(":visible")) {
			$( close.add( nav_left ).add( nav_right ) ).hide();

			var pos = wrap.position();

			start_pos = {
				top	: pos.top,
				left	: pos.left,
				width	: wrap.width(),
				height	: wrap.height()
			};

			var equal = (start_pos.width == final_pos.width && start_pos.height == final_pos.height);

			content.fadeTo(currentOpts.changeFade, 0.3, function() {
				var finish_resizing = function() {
					content.html( tmp.contents() ).fadeTo(currentOpts.changeFade, 1, _finish);
				};

				$.event.trigger('flybox-change');

				content	.empty()
					.css({
						'border-width' : currentOpts.padding,
						'width'	: final_pos.width - currentOpts.padding * 2,
						'height' : selectedOpts.autoDimensions ? 'auto' : final_pos.height - titleHeight - currentOpts.padding * 2
					});

				if (equal) {
					finish_resizing();

				} else {
					fx.prop = 0;
					$(fx).animate({prop: 1}, {
						duration : currentOpts.changeSpeed,
						easing : currentOpts.easingChange,
						step : _draw,
						complete : finish_resizing
					});
				}
			});

			return;
		}

		wrap.removeAttr("style");

		content.css('border-width', currentOpts.padding);

		if (currentOpts.transitionIn == 'elastic') {
			start_pos = _get_zoom_from();

			content.html(tmp.contents());

			wrap.show();

			if (currentOpts.opacity) {
				final_pos.opacity = 0;
			}

			fx.prop = 0;

			$(fx).animate({prop: 1}, {
				duration : currentOpts.speedIn,
				easing : currentOpts.easingIn,
				step : _draw,
				complete : _finish
			});

			return;
		}

		if (currentOpts.titlePosition == 'inside' && titleHeight > 0) {
			title.show();
		}

		content.css({
			'width' : final_pos.width - currentOpts.padding * 2,
			'height' : selectedOpts.autoDimensions ? 'auto' : final_pos.height - titleHeight - currentOpts.padding * 2
		}).html(tmp.contents());

		wrap.css(final_pos).fadeIn( currentOpts.transitionIn == 'none' ? 0 : currentOpts.speedIn, _finish );
	};

	var _format_title = function(title) {
		if (title && title.length) {
			return $('<div id="flybox-title-' + currentOpts.titlePosition + '"></div>').text(title);
		}
		return false;
	};

	var _process_title = function() {
		titleStr = currentOpts.title || '';
		titleHeight = 0;
		title	.empty()
			.removeAttr('style')
			.removeClass();

		if (currentOpts.titleShow === false) {
			title.hide();
			return;
		}

		titleElement = $.isFunction(currentOpts.titleFormat) ? currentOpts.titleFormat(titleStr, currentArray, currentIndex, currentOpts) : _format_title(titleStr);
		if (!titleElement) {
			title.hide();
			return;
		}

		title	.addClass('flybox-title-' + currentOpts.titlePosition)
			.append( titleElement )
			.appendTo( 'body' )
			.show();
		switch (currentOpts.titlePosition) {
			case 'inside':
				title.css({
					'width' : final_pos.width - (currentOpts.padding * 2),
					'marginLeft' : currentOpts.padding,
					'marginRight' : currentOpts.padding
				});
				titleHeight = title.outerHeight(true);
				title.appendTo( outer );
				final_pos.height += titleHeight;
				break;
			case 'over':
				title.css({
					'marginLeft' : currentOpts.padding,
					'width'	: final_pos.width - (currentOpts.padding * 2),
					'bottom' : currentOpts.padding
				}).appendTo( outer );
				break;
			case 'float':
				title.css({
					left: parseInt((title.width() - final_pos.width - 40)/ 2, 10) * -1
				}).appendTo( wrap );
				break;
			default:
				title.css({
					'width' : final_pos.width - (currentOpts.padding * 2),
					'paddingLeft' : currentOpts.padding,
					'paddingRight' : currentOpts.padding
				}).appendTo( wrap );
				break;
		}
		title.hide();
	};

	var _set_navigation = function() {
		if (currentOpts.enableEscapeButton || currentOpts.enableKeyboardNav) {
			$(document).bind('keydown.fb', function(e) {
				if (e.keyCode == 27 && currentOpts.enableEscapeButton) {
					e.preventDefault();
					$.flybox.close();

				} else if ((e.keyCode == 37 || e.keyCode == 39) && currentOpts.enableKeyboardNav && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
					e.preventDefault();
					$.flybox[ e.keyCode == 37 ? 'prev' : 'next']();
				}
			});
		}

		if (!currentOpts.showNavArrows) { 
			nav_left.hide();
			nav_right.hide();
			return;
		}

		if ((currentOpts.cyclic && currentArray.length > 1) || currentIndex !== 0) {
			nav_left.show();
		}

		if ((currentOpts.cyclic && currentArray.length > 1) || currentIndex != (currentArray.length -1)) {
			nav_right.show();
		}
	};

	var _finish = function () {
		if (selectedOpts.autoDimensions) {
			content.css('height', 'auto');
		}

		wrap.css('height', 'auto');

		if (titleStr && titleStr.length) {
			title.show();
		}

		if (currentOpts.showCloseButton) {
			close.show();
		}

		_set_navigation();

		if (currentOpts.hideOnContentClick)
			content.bind('click', $.flybox.close);

		if (currentOpts.hideOnOverlayClick)
			overlay.bind('click', $.flybox.close);

		$(window).bind("resize.fb", $.flybox.resize);

		if (currentOpts.centerOnScroll)
			$(window).bind("scroll.fb", $.flybox.center);

		if (currentOpts.type == 'iframe')
			$('<iframe id="flybox-frame" name="flybox-frame' + new Date().getTime() + '" frameborder="0" hspace="0" scrolling="' + selectedOpts.scrolling + '" src="' + currentOpts.href + '"></iframe>').appendTo(content);

		wrap.show();

		busy = false;

		$.flybox.center();

		currentOpts.onComplete(currentArray, currentIndex, currentOpts);

		_preload_images();
	};

	var _preload_images = function() {
		var href, objNext;
		if ((currentArray.length -1) > currentIndex) {
			href = currentArray[ currentIndex + 1 ].href;

			if (typeof href !== 'undefined' && href.match(selectedOpts.imageRegExp)) {
				objNext = new Image();
				objNext.src = href;
			}
		}
		if (currentIndex > 0) {
			href = currentArray[ currentIndex - 1 ].href;

			if (typeof href !== 'undefined' && href.match(selectedOpts.imageRegExp)) {
				objNext = new Image();
				objNext.src = href;
			}
		}
	};

	var _draw = function(pos) {
		var dim = {
			width	: parseInt(start_pos.width + (final_pos.width - start_pos.width) * pos, 10),
			height	: parseInt(start_pos.height + (final_pos.height - start_pos.height) * pos, 10),
			top	: parseInt(start_pos.top + (final_pos.top - start_pos.top) * pos, 10),
			left	: parseInt(start_pos.left + (final_pos.left - start_pos.left) * pos, 10)
		};

		if (typeof final_pos.opacity !== 'undefined') {
			dim.opacity = pos < 0.5 ? 0.5 : pos;
		}

		wrap.css(dim);

		content.css({
			'width' : dim.width - currentOpts.padding * 2,
			'height' : dim.height - (titleHeight * pos) - currentOpts.padding * 2
		});
	};

	var _get_viewport = function() {
		return [
			$(window).width() - (currentOpts.margin * 2),
			$(window).height() - (currentOpts.margin * 2),
			$(document).scrollLeft() + currentOpts.margin,
			$(document).scrollTop() + currentOpts.margin
		];
	};

	var _get_zoom_to = function () {
		var	view = _get_viewport(),
			to = {},
			resize = currentOpts.autoScale,
			double_padding = currentOpts.padding * 2,
			ratio;

		if (currentOpts.width.toString().indexOf('%') > -1) {
			to.width = parseInt((view[0] * parseFloat(currentOpts.width)) / 100, 10);
		} else {
			to.width = currentOpts.width + double_padding;
		}

		if (currentOpts.height.toString().indexOf('%') > -1) {
			to.height = parseInt((view[1] * parseFloat(currentOpts.height)) / 100, 10);
		} else {
			to.height = currentOpts.height + double_padding;
		}

		if (resize && (to.width > view[0] || to.height > view[1])) {
			if (selectedOpts.type == 'image') {
				ratio = (currentOpts.width ) / (currentOpts.height );

				if ((to.width ) > view[0]) {
					to.width = view[0];
					to.height = parseInt(((to.width - double_padding) / ratio) + double_padding, 10);
				}

				if ((to.height) > view[1]) {
					to.height = view[1];
					to.width = parseInt(((to.height - double_padding) * ratio) + double_padding, 10);
				}

			} else {
				to.width = Math.min(to.width, view[0]);
				to.height = Math.min(to.height, view[1]);
			}
		}

		to.top = parseInt(Math.max(view[3] - 20, view[3] + ((view[1] - to.height - 40) * 0.5)), 10);
		to.left = parseInt(Math.max(view[2] - 20, view[2] + ((view[0] - to.width - 40) * 0.5)), 10);

		return to;
	};

	var _get_obj_pos = function(obj) {
		var pos = obj.offset();

		pos.top += parseInt( obj.css('paddingTop'), 10 ) || 0;
		pos.left += parseInt( obj.css('paddingLeft'), 10 ) || 0;

		pos.top += parseInt( obj.css('border-top-width'), 10 ) || 0;
		pos.left += parseInt( obj.css('border-left-width'), 10 ) || 0;

		pos.width = obj.width();
		pos.height = obj.height();

		return pos;
	};

	var _get_zoom_from = function() {
		var orig = selectedOpts.orig ? $(selectedOpts.orig) : false;
		if (orig && orig.length) {
			var pos = _get_obj_pos(orig);
			return {
				width	: pos.width + (currentOpts.padding * 2),
				height	: pos.height + (currentOpts.padding * 2),
				top	: pos.top - currentOpts.padding - 20,
				left	: pos.left - currentOpts.padding - 20
			};
		}
		var view = _get_viewport();
		return {
			width	: currentOpts.padding * 2,
			height	: currentOpts.padding * 2,
			top	: parseInt(view[3] + view[1] * 0.5, 10),
			left	: parseInt(view[2] + view[0] * 0.5, 10)
		};
	};

	var _animate_loading = function() {
		if (!loading.is(':visible')) {
			clearInterval(loadingTimer);
			return;
		}
		loading.css('background-position', '0px -' + (loadingFrame * 40) + 'px');
		loadingFrame = (loadingFrame + 1) % 12;
	};

	$.fn.flybox = function(options) {
		if (!$(this).length)
			return this;

		$(this)	.data('flybox', $.extend({}, options, ($.metadata ? $(this).metadata() : {})))
			.unbind('click.fb').bind('click.fb', function(e) {
				e.preventDefault();

				if (busy) {
					return;
				}
				busy = true;

				$(this).blur();

				selectedArray = [];
				selectedIndex = 0;

				var rel = $(this).attr('rel') || '';
				if (!rel || rel == '' || rel === 'nofollow') {
					selectedArray.push(this);
				} else {
					selectedArray = $("a[rel=" + rel + "], area[rel=" + rel + "]");
					selectedIndex = selectedArray.index( this );
				}

				_start();
				return;
			});

		return this;
	};

	$.flybox = function(obj) {
		if (busy) {
			return;
		}
		busy = true;

		var opts = typeof arguments[1] !== 'undefined' ? arguments[1] : {};

		selectedArray = [];
		selectedIndex = parseInt(opts.index, 10) || 0;

		if ($.isArray(obj)) {
			for (var i = 0, j = obj.length; i < j; i++) {
				if (typeof obj[i] == 'object') {
					$(obj[i]).data('flybox', $.extend({}, opts, obj[i]));
				} else {
					obj[i] = $({}).data('flybox', $.extend({content : obj[i]}, opts));
				}
			}
			selectedArray = jQuery.merge(selectedArray, obj);
		} else {
			if (typeof obj == 'object') {
				$(obj).data('flybox', $.extend({}, opts, obj));
			} else {
				obj = $({}).data('flybox', $.extend({content : obj}, opts));
			}
			selectedArray.push(obj);
		}

		if (selectedIndex > selectedArray.length || selectedIndex < 0) {
			selectedIndex = 0;
		}

		_start();
	};

	$.flybox.showActivity = function() {
		clearInterval(loadingTimer);
		loading.show();
		loadingTimer = setInterval(_animate_loading, 66);
	};
	$.flybox.hideActivity = function() {
		loading.hide();
	};
	$.flybox.next = function() {
		return $.flybox.pos( currentIndex + 1);
	};
	$.flybox.prev = function() {
		return $.flybox.pos( currentIndex - 1);
	};
	$.flybox.pos = function(pos) {
		if (busy) {
			return;
		}

		pos = parseInt(pos);

		selectedArray = currentArray;

		if (pos > -1 && pos < currentArray.length) {
			selectedIndex = pos;
			_start();
		} else if (currentOpts.cyclic && currentArray.length > 1) {
			selectedIndex = pos >= currentArray.length ? 0 : currentArray.length - 1;
			_start();
		}
		return;
	};
	$.flybox.cancel = function() {
		if (busy) {
			return;
		}
		busy = true;

		$.event.trigger('flybox-cancel');

		_abort();

		selectedOpts.onCancel(selectedArray, selectedIndex, selectedOpts);

		busy = false;
	};

	// Note: within an iframe use - parent.$.flybox.close();
	$.flybox.close = function() {
		if (busy || wrap.is(':hidden')) {
			return;
		}
		busy = true;

		if (currentOpts && false === currentOpts.onCleanup(currentArray, currentIndex, currentOpts)) {
			busy = false;
			return;
		}

		_abort();

		$(close.add( nav_left ).add( nav_right )).hide();

		$(content.add( overlay )).unbind();

		$(window).unbind("resize.fb scroll.fb");
		$(document).unbind('keydown.fb');

		content.find('iframe').attr('src', 'about:blank');

		if (currentOpts.titlePosition !== 'inside') {
			title.empty();
		}

		wrap.stop();

		function _cleanup() {
			overlay.fadeOut('fast');

			title.empty().hide();
			wrap.hide();

			$.event.trigger('flybox-cleanup');

			content.empty();

			currentOpts.onClosed(currentArray, currentIndex, currentOpts);

			currentArray = selectedOpts	= [];
			currentIndex = selectedIndex = 0;
			currentOpts = selectedOpts	= {};

			busy = false;
		}

		if (currentOpts.transitionOut == 'elastic') {
			start_pos = _get_zoom_from();

			var pos = wrap.position();

			final_pos = {
				top	: pos.top,
				left	: pos.left,
				width	: wrap.width(),
				height	: wrap.height()
			};

			if (currentOpts.opacity) {
				final_pos.opacity = 1;
			}

			title.empty().hide();

			fx.prop = 1;
			$(fx).animate({prop: 0}, {
				 duration : currentOpts.speedOut,
				 easing : currentOpts.easingOut,
				 step : _draw,
				 complete : _cleanup
			});

		} else {
			wrap.fadeOut( currentOpts.transitionOut == 'none' ? 0 : currentOpts.speedOut, _cleanup);
		}
	};

	$.flybox.resize = function() {
		if (overlay.is(':visible')) {
			overlay.css('height', $(document).height());
		}
		$.flybox.center(true);
	};

	$.flybox.center = function() {
		if (busy) {
			return;
		}

		var view = _get_viewport();
		if ((arguments[0] !== true) && (wrap.width() > view[0] || wrap.height() > view[1]))
			return;

		wrap.stop().animate({
			'top'	: parseInt(Math.max(view[3] - 20, view[3] + ((view[1] - content.height() - 40) * 0.5) - currentOpts.padding)),
			'left'	: parseInt(Math.max(view[2] - 20, view[2] + ((view[0] - content.width() - 40) * 0.5) - currentOpts.padding))
		}, typeof arguments[0] == 'number' ? arguments[0] : 200);
	};

	$.flybox.init = function() {
		if ($("#flybox-wrap").length) {
			return;
		}

		$('body').append(
			tmp	= $('<div id="flybox-tmp"></div>'),
			loading	= $('<div id="flybox-loading"></div>').click($.flybox.cancel),
			overlay	= $('<div id="flybox-overlay"></div>'),
			wrap	= $('<div id="flybox-wrap"></div>').append(
				outer = $('<div id="flybox-outer"></div>').append(
					content		= $('<div id="flybox-content"></div>'),
					close		= $('<a id="flybox-close"></a>').click($.flybox.close),
					title		= $('<div id="flybox-title"></div>'),
					nav_left	= $('<div id="flybox-left"><span></span></div>').click($.flybox.prev),
					nav_right	= $('<div id="flybox-right"><span></span></div>').click($.flybox.next)
				)
			)
		);

		if ($.fn.mousewheel) {
			wrap.bind('mousewheel.fb', function(e, delta) {
				if (busy) {
					e.preventDefault();
				} else if ($(e.target).get(0).clientHeight == 0 || $(e.target).get(0).scrollHeight === $(e.target).get(0).clientHeight) {
					e.preventDefault();
					$.flybox[ delta > 0 ? 'prev' : 'next']();
				}
			});
		}
	};

	$.fn.flybox.defaults = {
		padding : 10,
		margin : 40,
		opacity : false,
		modal : false,
		cyclic : false,
		scrolling : 'auto',	// 'auto', 'yes' or 'no'

		width : 560,
		height : 340,

		autoScale : true,
		autoDimensions : true,
		centerOnScroll : false,

		ajax : {},

		hideOnOverlayClick : true,
		hideOnContentClick : false,

		overlayShow : true,
		overlayOpacity : 0.7,
		overlayColor : '#777',

		titleShow : true,
		titlePosition : 'float', // 'float', 'outside', 'inside' or 'over'
		titleFormat : null,
		titleFromAlt : false,

		transitionIn : 'fade', // 'elastic', 'fade' or 'none'
		transitionOut : 'fade', // 'elastic', 'fade' or 'none'

		speedIn : 300,
		speedOut : 300,

		changeSpeed : 300,
		changeFade : 'fast',

		easingIn : 'swing',
		easingOut : 'swing',

		showCloseButton : true,
		showNavArrows : true,
		enableEscapeButton : true,
		enableKeyboardNav : true,

		imageRegExp: /\.(jpg|gif|png|bmp|jpeg)(.*)?$/i,

		onStart : function(){},
		onCancel : function(){},
		onComplete : function(){},
		onCleanup : function(){},
		onClosed : function(){},
		onError : function(){}
	};

	$($.flybox.init);
})(jQuery);