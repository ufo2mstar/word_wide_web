const WCX_TOPIC_ID = "deskperience_word_capture_x_topic_id";
var Cc             = Components.classes;
var Ci             = Components.interfaces;
var g_wcxObserver  = null;
var g_wcxPlugin	   = null;

main();

function main()
{
	// Do not try to add a callback until the browser window has been initialised. We add a callback to the tabbed browser when the browser's window gets loaded.
	window.addEventListener("load",
		function () {
			g_wcxObserver = new WcxObserver();
			
			g_wcxPlugin = document.getElementById('wcx_plugin');
			g_wcxPlugin.addEventListener("capture", g_wcxObserver.notify, false);

			// Add a callback to be run every time a document loads. Note that this includes frames/iframes within the document
			var appcontent = document.getElementById("appcontent");   // browser  
			if(appcontent) appcontent.addEventListener("DOMContentLoaded", onInitWCX, true);  
			var messagepane = document.getElementById("messagepane"); // mail  
			if(messagepane) messagepane.addEventListener("load", onInitWCX, true);  
		},
		false
	);

	window.addEventListener("unload", CleanUp, false);
}

function isActiveWindow() {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var win = wm.getMostRecentWindow("navigator:browser");

	if (!win) {
		win = wm.getMostRecentWindow("mail:3pane");
	}

	return (win == window) ? true : false;
}

function onInitWCX() {
	window.addEventListener('mousemove',   onMouseMove,   true);
	window.addEventListener('mousedown',   onMouseDown,   true);
	window.addEventListener('mouseup',     onMouseUp,     true);
	window.addEventListener('contextmenu', onContextMenu, true);
}


function onContextMenu(evt) {
	if (evt.ctrlKey || evt.altKey  || evt.shiftKey)	{
		evt.preventDefault();
		evt.stopPropagation();

		return false;
	}

	return true;
}


function onMouseDown(evt) {
	var actionElem = evt.target;
	if (actionElem instanceof Components.interfaces.nsIDOMHTMLElement) {
		WcxLogMessage("onMouseDown on HTML element");

		window.lastMouseDownNode   = evt.rangeParent;
		window.lastMouseDownOffset = evt.rangeOffset;
		window.lastMouseDownElem   = actionElem;

		// Eat mouse up if special keys are pressed (to prevent middle mouse button to trigger scrolling).
		if ((evt.ctrlKey || evt.altKey  || evt.shiftKey) && (1 == evt.button))	{
			evt.preventDefault();
			evt.stopPropagation();

			return false;
		}		
	}

	return true;
}


function onMouseUp(evt) {
	var actionElem = evt.target;
	if (actionElem instanceof Components.interfaces.nsIDOMHTMLElement) {
		WcxLogMessage("onMouseUp on HTML element");

		window.lastMouseUpNode   = evt.rangeParent;
		window.lastMouseUpOffset = evt.rangeOffset;

		// Eat mouse up if special keys are pressed (to prevent middle mouse button to trigger scrolling).
		/*if ((evt.ctrlKey || evt.altKey  || evt.shiftKey) && (1 == evt.button))	{
				evt.preventDefault();
				evt.stopPropagation();

				return false;
		}*/		
	}

	return true
}


function onMouseMove(evt) {
	var actionElem = evt.target;
	if (actionElem instanceof Components.interfaces.nsIDOMHTMLElement) {
		//WcxLogMessage("onMouseMove on HTML element");
		window.lastWcxNode   = evt.rangeParent;
		window.lastWcxOffset = evt.rangeOffset;
		window.lastWcxElem   = actionElem;
	}
}


function CleanUp(evt)
{
	if (g_wcxObserver)
	{
		g_wcxObserver.unregister();
		g_wcxObserver = null;
	}

	// TODO: it might be necessary to shut down wcxComm service as in WR.
}


function getParagraphElement(node) {
	while (true)
	{
		if (node.nodeType == 1)	{
			break;
		}

		node = node.parentNode;
		if (!node) {
			break;
		}
	}

	var tagName = node.tagName.toUpperCase();
	switch (tagName) {
		case "A":
		case "B":
		case "I":
		case "U":
		case "LABEL":
		case "FONT":
		{
			node = node.parentNode;
			break;
		}
	}

	return node;
}


function WcxObserver() {
    this.register();
}


WcxObserver.prototype = {
    observe: function(subject, topic, data) {
		WcxLogMessage("wcx observed event");
		OnCapture(subject);
    },
	
	notify: function() {
		WcxLogMessage("wcx notify observers");
		var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        observerService.notifyObservers(g_wcxPlugin, WCX_TOPIC_ID, false);
	},

    register: function() {
        var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        observerService.addObserver(this, WCX_TOPIC_ID, false);
    },

    unregister: function() {
        var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        observerService.removeObserver(this, WCX_TOPIC_ID);
    }
}


function getStartOffsetInParent(node, parentNode) {
	var parentRange = window.content.document.createRange();

	parentRange.selectNode(parentNode);
	parentRange.setEndBefore(node);

	return parentRange.toString().length;
}


function OnCapture(wcxComm) {
	WcxLogMessage("OnCapture start");

	try	{
		if (!isActiveWindow()) {
			WcxLogMessage("OnCapture !isActiveWindow");
			return;
		}

		// Input
		var separators = wcxComm.separators;
		var leftCtxNo  = wcxComm.contextLeft;
		var rightCtxNo = wcxComm.contextRight;
		var useGesture = wcxComm.useGesture;

		WcxLogMessage("OnCapture input: ", leftCtxNo, rightCtxNo, useGesture);

		// Output
		var currentWord  = "";
		var fullText     = "";
		var leftContext  = "";
		var rightContext = "";
		var startIndex   = 0;
		var leftStart    = 0;
		var rightStart   = 0;
		var paragraph    = "";		

		var crntWnd = window.content;
		var crntDoc = crntWnd.document;

		var initialRange = null;
		var actionElem   = null;

		if (!useGesture) {

			var selNode   = window.lastWcxNode;
			var selOffset = window.lastWcxOffset;

			if (!selNode) {
				WcxLogMessage("OnCapture !selNode");
				wcxComm.pushTextResult("", -1, "", "", "");

				return;
			}

			initialRange  = crntDoc.createRange();
			initialRange.setStart(selNode, selOffset);
			initialRange.collapse(true);
			startIndex = selOffset;

			actionElem = window.lastWcxElem;

			// Get paragraph text.
			var paraNode     = getParagraphElement(selNode);
			var captureRange = crntDoc.createRange();

			captureRange.selectNode(paraNode);
			paragraph = captureRange.toString();
			fullText  = paragraph;

			startIndex += getStartOffsetInParent(selNode, paraNode);

			leftStart  = startIndex;
			rightStart = startIndex + 1;
		}
		else {
			// Get the starting point.
			var rangeStart  = crntDoc.createRange();
			var startNode   = window.lastMouseDownNode;
			var startOffset = window.lastMouseDownOffset;

			window.lastMouseDownNode   = null;
			window.lastMouseDownOffset = null;

			actionElem = window.lastMouseDownElem;

			if (!startNode) {
				WcxLogMessage("OnCapture !startNode");
				wcxComm.pushTextResult("", -1, "", "", "");

				return;
			}

			rangeStart.setStart(startNode, startOffset);

			// Get the ending point.
			var rangeEnd  = crntDoc.createRange();
			var endNode   = window.lastMouseUpNode;
			var endOffset = window.lastMouseUpOffset;

			window.lastMouseUpNode   = null;
			window.lastMouseUpOffset = null;

			if (!endNode) {
				WcxLogMessage("OnCapture !endNode");
				wcxComm.pushTextResult("", -1, "", "", "");

				return;
			}

			rangeEnd.setStart(endNode, endOffset);

			initialRange = rangeStart;
			initialRange.setEnd(rangeEnd.startContainer, rangeEnd.startOffset);

			var initialLen       = initialRange.toString().length;
			var initialContainer = initialRange.commonAncestorContainer;

			startIndex = initialRange.startOffset;

			var paraNode  = getParagraphElement(initialContainer);
			var paraRange = crntDoc.createRange();
			paraRange.selectNode(paraNode);

			var paragraph = paraRange.toString();
			var fullText  = paragraph;

			startIndex += getStartOffsetInParent(initialRange.startContainer, paraNode);

			leftStart  = startIndex;
			rightStart = startIndex + initialLen;
		}

		WcxLogMessage("OnCapture start processing, fullText=", fullText, " startIndex=", startIndex);

		// Word + contexts processing.
		var wasCJK = false;
		var isRTL  = false;

		while (leftStart > 0) {
			var crntChar     = fullText[leftStart];
			var crntCharCode = fullText.charCodeAt(leftStart);
			var isCJKChar    = 
				(
					((crntCharCode >= 0x3300) && (crntCharCode <= 0x33FF)) || 
					((crntCharCode >= 0x3400) && (crntCharCode <= 0x4DB5)) ||
					((crntCharCode >= 0x4E00) && (crntCharCode <= 0x9FFF)) ||
					((crntCharCode >= 0xF900) && (crntCharCode <= 0xFAFF)) ||
					((crntCharCode >= 0xFE30) && (crntCharCode <= 0xFE4F))
				);

			if (!isRTL)	{
				// Hebrew or arab.
				isRTL = (((crntCharCode >= 0x0590) && (crntCharCode <= 0x05FF)) || ((crntCharCode >= 0x0600) && (crntCharCode <= 0x06FF)));
			}
			
			if (separators.indexOf(crntChar) != -1)	{
				// crntChar is a separator.
				leftStart++;
				break;
			}
			else if (isCJKChar)	{
				wasCJK = true;
				break;
			}

			leftStart--;
		}

		while (rightStart < fullText.length) {
			var crntChar     = fullText[rightStart];
			var crntCharCode = fullText.charCodeAt(rightStart);
			var isCJKChar    = 
				(
					((crntCharCode >= 0x3300) && (crntCharCode <= 0x33FF)) || 
					((crntCharCode >= 0x3400) && (crntCharCode <= 0x4DB5)) ||
					((crntCharCode >= 0x4E00) && (crntCharCode <= 0x9FFF)) ||
					((crntCharCode >= 0xF900) && (crntCharCode <= 0xFAFF)) ||
					((crntCharCode >= 0xFE30) && (crntCharCode <= 0xFE4F))
				);

			if (!isRTL)	{
				// Hebrew or arab.
				isRTL = (((crntCharCode >= 0x0590) && (crntCharCode <= 0x05FF)) || ((crntCharCode >= 0x0600) && (crntCharCode <= 0x06FF)));
			}

			if ((separators.indexOf(crntChar) != -1) || isCJKChar) {
				// crntChar is a separator.
				break;
			}

			rightStart++;
		}

		currentWord = fullText.substring(leftStart, rightStart);

		// If hebrew word (contains at least one hewbrew char) then reverse it.
		var isWordRTL = false;
		if (isRTL) {
			var revWord = "";
			for (var x = currentWord.length - 1; x >= 0; x--) {
				revWord = revWord + currentWord.charAt(x);
			}
			
			currentWord = revWord;
			isWordRTL   = true;
		}

		isRTL = false;

		if (wcxComm.highlight) {
			// Select the word.
			if (isTextContainer(actionElem)) {
				WcxLogMessage("OnCapture actionElem isTextContainer");

				actionElem.focus();
				actionElem.setSelectionRange(leftStart, rightStart);
				
				// Set a timeout for clearing the selected word so the user will get some feedback.
				crntWnd.setTimeout(
					function () {
						try	{
							actionElem.selectionEnd = actionElem.selectionStart;
						}
						catch (ex) {
						}
					},
					250
				);
			}
			else {
				var selObj = crntWnd.getSelection();
				if ((selObj != null) && (initialRange != null))	{

					initialRange.setStart(initialRange.startContainer, initialRange.startOffset - startIndex + leftStart);
					initialRange.collapse(true);
					selObj.removeAllRanges();
					selObj.addRange(initialRange);
					
					for (var extRight = 0; extRight < rightStart - leftStart; ++extRight) {
						selObj.modify("extend", "forward", "character");
					}

					// Set a timeout for clearing the selected word so the user will get some feedback.
					crntWnd.setTimeout(
						function () {
							try	{
								crntWnd.getSelection().removeAllRanges();
							}
							catch (ex) {
							}
						},
						250
					);
				}
			}
		}

		// Compute right context.
		WcxLogMessage("OnCapture Compute right context");
		
		if (wasCJK)	{
			if (separators.indexOf(fullText[rightStart]) != -1)	{
				rightStart++;
			}
		}
		
		var rightCtxEnd = rightStart;
		while ((rightCtxEnd < fullText.length) && (rightCtxNo > 0))	{
			rightCtxEnd++;
			var crntChar     = fullText[rightCtxEnd];
			var crntCharCode = fullText.charCodeAt(rightCtxEnd);
			var isCJKChar    = 
				(
					((crntCharCode >= 0x3300) && (crntCharCode <= 0x33FF)) || 
					((crntCharCode >= 0x3400) && (crntCharCode <= 0x4DB5)) ||
					((crntCharCode >= 0x4E00) && (crntCharCode <= 0x9FFF)) ||
					((crntCharCode >= 0xF900) && (crntCharCode <= 0xFAFF)) ||
					((crntCharCode >= 0xFE30) && (crntCharCode <= 0xFE4F))
				);

			if (!isRTL)	{
				// Hebrew or arab.
				isRTL = (((crntCharCode >= 0x0590) && (crntCharCode <= 0x05FF)) || ((crntCharCode >= 0x0600) && (crntCharCode <= 0x06FF)));
			}

			if ((separators.indexOf(crntChar) != -1) || isCJKChar) {
				rightCtxNo--;
			}
		}

		if (rightStart <= rightCtxEnd) {
			rightContext = fullText.substring(rightStart, rightCtxEnd);

			// If hebrew word (contains at least one hewbrew char) then reverse it.
			if (isRTL) {
				var revRightWord = "";
				for (var y = rightContext.length - 1; y >= 0; y--) {
					revRightWord = revRightWord + rightContext.charAt(y);
				}
				
				rightContext = revRightWord;
			}				
		}
		
		isRTL = false;

		// Compute left context.
		WcxLogMessage("OnCapture Compute left context");
		
		if (wasCJK)	{
			if ((leftStart > 1) && (separators.indexOf(fullText[leftStart - 1]) != -1))	{
				leftStart--;
			}
		}

		var leftContextStart = (wasCJK ? leftStart : leftStart - 1);
		while ((leftContextStart > 0) && (leftCtxNo > 0)) {
			leftContextStart--;

			var crntChar     = fullText[leftContextStart];
			var crntCharCode = fullText.charCodeAt(leftContextStart);
			var isCJKChar    = 
				(
					((crntCharCode >= 0x3300) && (crntCharCode <= 0x33FF)) || 
					((crntCharCode >= 0x3400) && (crntCharCode <= 0x4DB5)) ||
					((crntCharCode >= 0x4E00) && (crntCharCode <= 0x9FFF)) ||
					((crntCharCode >= 0xF900) && (crntCharCode <= 0xFAFF)) ||
					((crntCharCode >= 0xFE30) && (crntCharCode <= 0xFE4F))
				);

			if (!isRTL)	{
				// Hebrew or arab.
				isRTL = (((crntCharCode >= 0x0590) && (crntCharCode <= 0x05FF)) || ((crntCharCode >= 0x0600) && (crntCharCode <= 0x06FF)));
			}

			if ((separators.indexOf(crntChar) != -1) || isCJKChar) {
				leftCtxNo--;
			}
		}

		if (!wasCJK) {
			if ((leftContextStart <= leftStart - 1) && (leftStart > 0))	{
				leftContext = fullText.substring(leftContextStart, leftStart - 1);
				
				// If hebrew word (contains at least one hewbrew char) then reverse it.
				if (isRTL) {
					var revLeftWord = "";
					for (var z = leftContext.length - 1; z >= 0; z--) {
						revLeftWord = revLeftWord + leftContext.charAt(z);
					}

					leftContext = revLeftWord;
				}					
			}
		}
		else {
			if ((leftContextStart <= leftStart) && (leftStart > 0))	{
				leftContext = fullText.substring(leftContextStart, leftStart);
			}			
		}

		isRTL = false;
		
		if (isWordRTL) {
			// For RTL languages invert right ctx with left ctx.
			var tempCtx = leftContext;
			leftContext  = rightContext;
			rightContext = tempCtx;
		}
	}
	catch (ex) {
		// On exception don't send anything back.
		WcxLogMessage("OnCapture catch ya", ex);
		wcxComm.pushTextResult("", -1, "", "", "");
		
		return;
	}

	WcxLogMessage("OnCapture PushTextResult ", currentWord, leftContext, rightContext, startIndex - leftStart);
	wcxComm.pushTextResult(currentWord, startIndex - leftStart, paragraph, leftContext, rightContext);

	WcxLogMessage("OnCapture end");
}


function isTextContainer(elem) {
	if (elem && (elem instanceof Components.interfaces.nsIDOMHTMLElement)) {
		if(((elem.tagName.toLowerCase() == "input") && (elem.type.toLowerCase() == "text")) ||
		   (elem.tagName.toLowerCase() == "textarea")) {
			return true;
	   }
	}
	else {
		return false;
	}
}
