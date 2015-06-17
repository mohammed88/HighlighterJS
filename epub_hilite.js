/**
 * Select, save and re-apply text selections for e-pub
 * @author Mohammed Khadar, Apps Studio - Team
 * Dependencies: Content should not have span's with the first class = "highlight"
 */

/*  Code to add event listener/handler for 'click' event on highlights 
 	document.addEventListener('click', clickHandler);
	function clickHandler(e){
		if(e.target.className.split(" ")[0] === "highlight"){
			//Prevent event bubbling
			 //IE9 & Other Browsers
		    if (e.stopPropagation) {
		      e.stopPropagation();
		    }
		    //IE8 and Lower
		    else {
		      e.cancelBubble = true;
		    }
			alert("function(" + e.target.className.split(" ")[1] + ")");
		}
	}
 */
var Hilite = { 
	
	hiliteTag : "span", /* This tag is used as a wrapper for highlighted text */
	xpaths: [], /* array of XPath's of selected text nodes */
	removeClasses:[], /* remove selections, due to merge operation */
	merge : true,	/* Flag to avoid merging on applyHighlight  */
	savedSelectionWithoutBase64: null, /* Tocheck the saved slection (without base64 encoding for debugging */
	
	log: function(msg){
		//console.log(msg); //comment this line for iOS
	},
	
	/**
	 * Traverse through the DOM using XPath and retun the element
	 * @return DOMElement
	 */
	
	getElementFromXPath: function(doc,xpath){
				
		var element;
		var xpathNodes = xpath.split("/"); 
		xpathNodes.shift();xpathNodes.shift();//xpathNodes.shift();//remove the first empty, <HTML> and <BODY> element
		
		var nodeList = doc.body.childNodes;
		var nodeListArr = [];
		/* Moving the elements from nodeList to an array - todo unshift operation - to add <body> */
		for(var i = nodeList.length; i--; nodeListArr.unshift(nodeList[i]));
		nodeListArr.unshift(doc.body);		
	 
	    //for(var i=0; i < xpathNodes.length; i++){
	    var i = 0, miss = 0;
	    while( i < xpathNodes.length && miss < 2) {
	    	     	
            var node, index;
            if(xpathNodes[i].indexOf("[") !== -1) { //index exists
            	var node_index = xpathNodes[i].split("[");
            	node = node_index[0];
            	node_index = node_index[1].split("]");
            	index = parseInt(node_index[0]);	            	
            }
            else{
            	node = xpathNodes[i];
            	index = 1;
            } 
           
            for(var j = 0, len = nodeListArr.length; j < len; j++) { //check for the xpathNode in the nodeList            	
            	if(nodeListArr[j].nodeName.toUpperCase() === node.toUpperCase()){
            		--index;
            		if(index === 0){
      					element = nodeListArr[j];
      					nodeListArr = element.childNodes; /* converting the array to nodeList - since no more array operations are required */ 
						i++;      					    					
      					break;     
      				}       	
            	}
        	}
        	if(j === len){ // TO HANDLE MISMATCH IN XPATH SEQUENCE, EX: TBODY MISSING..       		
        		if(node.toUpperCase() === 'TR'){
        			for(var j_m = 0, len_m = nodeListArr.length; j_m < len_m; j_m++) { //check for the xpathNode in the nodeList            	
            			if(nodeListArr[j_m].nodeName.toUpperCase() === 'TBODY'){
            				element = nodeListArr[j_m];
		      				nodeListArr = element.childNodes; /* converting the array to nodeList - since no more array operations are required */ 
							break;		      				
            			}
            		}  			
        		} 
        		else if(node.toUpperCase() === 'TBODY'){
        			i++; // SKIP AND LOOK FOR THE NEXT NODE <tr>
        		}
        		else {
        			miss++;
        		}        		
        	}
        }        
        return element;		
	},
	
	/**
	 *  Return the XPath of a DOMElement (ignoring <span class="highlight"></span>)
	 *  @param DOMElement
	 *  @return XPath string
	 */
	
	getXPath: function (element){ 
	    
	    var xpath = '';
	    for ( ; element && element.nodeType == 1; element = element.parentNode )
	    {
	    	/* jQuery code: var id = $(element.parentNode).children(element.tagName).index(element) + 1; */	        
	        /* calculate the index of occurance of the "element" w.r.t the parentNode */   
	        var checkPrevSiblingsOfElement = element.previousSibling;
	        var id = 1;
			
			while(checkPrevSiblingsOfElement != null) {	// It becomes null when it runs  out of previous nodes				
				if(checkPrevSiblingsOfElement.nodeType === 1){ 	// Execute only if previousNode is an ELEMENT_NODE (especially omit text nodes)
					if(checkPrevSiblingsOfElement.tagName.toLowerCase() === element.tagName.toLowerCase()){
						if(checkPrevSiblingsOfElement.tagName.toLowerCase() === "span"){ // Ignore spans with 1st class = "highlight"
							var classHighlight =  (checkPrevSiblingsOfElement.getAttribute('class') !== null) ? checkPrevSiblingsOfElement.getAttribute('class').split(" ") : [null];
							if(classHighlight[0] !== "highlight"){
								id++;
							}								
						} else {
							id++;
						}					
					}
				}
				checkPrevSiblingsOfElement = checkPrevSiblingsOfElement.previousSibling;				
			}
	               
	        id > 1 ? (id = '[' + id + ']') : (id = '');
	        xpath = '/' + element.tagName.toLowerCase() + id + xpath;
	    }
	    return xpath;	
	},
	
	/**
	 * Get the next node, used for DOM traversal
	 * @param DOMElement - node context
	 * @return DOMElement - next node wrt parameter
	 */
	
	getNextNode: function ( node ){
	    if (node.firstChild)
	        return node.firstChild;
	        
	    while (node)
	    {
	        if (node.nextSibling)
	            return node.nextSibling;
	        node = node.parentNode;
	    }
	},
		
	/**
	 * Creation of compatible Range object for <IE8
	 * @param RangeObject - window.selection
	 * @return RangeObject - Range object having 'startContainer, startOffset, endContainer, endOffset' properties						
	 */
	
	fixIERangeObject: function(range) {
		
		if (!range)
			return null;
		if (!range.startContainer && document.selection) { // IE8 and below
			var _findTextNode = function(parentElement, text) {
				/* Iterate through all the child text nodes and check for matches */
				/* As we go through each text node keep removing the text value (substring) from the beginning of the text variable.*/
				var container = null, offset = -1;
				for (var node = parentElement.firstChild; node; node = node.nextSibling) {
					if (node.nodeType == 3) {//Text node
						var find = node.nodeValue;
						var pos = text.indexOf(find);
						if (pos == 0 && text != find) {//text==find is a special case
							text = text.substring(find.length);
						} else {
							container = node;
							offset = text.length - 1;
							/* Offset to the last character of text. text[text.length-1] will give the last character. */
							break;
						}
					}
				}
				/* Debug Message : alert(container.nodeValue); */
				return {
					node : container,
					offset : offset
				};				
			}
			var rangeCopy1 = range.duplicate(), rangeCopy2 = range.duplicate(); // Create a copy
			var rangeObj1 = range.duplicate(), rangeObj2 = range.duplicate(); // More copies :P
	
			rangeCopy1.collapse(true); // Go to beginning of the selection
			rangeCopy1.moveEnd('character', 1);	// Select only the first character
			rangeCopy2.collapse(false);	// Go to the end of the selection
			rangeCopy2.moveStart('character', -1); // Select only the last character
			/* Debug Message : alert(rangeCopy1.text); //Should be the first character of the selection */
			var parentElement1 = rangeCopy1.parentElement(), parentElement2 = rangeCopy2.parentElement();
			// If user clicks the input button without selecting text, then moveToElementText throws an error.
			if ( parentElement1 instanceof HTMLInputElement || parentElement2 instanceof HTMLInputElement) {
				return null;
			}
			rangeObj1.moveToElementText(parentElement1); // Select all text of parentElement
			rangeObj1.setEndPoint('EndToEnd', rangeCopy1); // Set end point to the first character of the 'real' selection
			rangeObj2.moveToElementText(parentElement2);
			rangeObj2.setEndPoint('EndToEnd', rangeCopy2); // Set end point to the last character of the 'real' selection
			var text1 = rangeObj1.text;	// Now we get all text from parentElement's first character upto the real selection's first character
			var text2 = rangeObj2.text;	// Here we get all text from parentElement's first character upto the real selection's last character
			var nodeInfo1 = _findTextNode(parentElement1, text1);
			var nodeInfo2 = _findTextNode(parentElement2, text2);			
			
			range.startContainer = nodeInfo1.node;
			range.startOffset = nodeInfo1.offset;
			range.endContainer = nodeInfo2.node;
			range.endOffset = nodeInfo2.offset + 1; // End offset comes 1 position after the last character of selection.
		}
		return range;
	},
	
	/**
	 * Return only uniques elements in an array
	 * @param Array arr
	 * @return Array a - Unique elemnts form arr[]
	 */
	
	getUniqueClasses: function(arr){
		
	   var u = {}, a = [];
	   for(var i = 0, l = arr.length; i < l; ++i){
	      if(u.hasOwnProperty(arr[i].className)){
	         continue;
	      }
	      a.push(arr[i].className);
	      u[arr[i].className] = 1;
	   }
	   return a;
	},	
	
	/**
	 * Check id an array has an object
	 * @param Array arr - Array
	 * @param {Object} obj - check if obj is present in arr[]
	 * @return Boolean true-If present; else, false  
	 */
	
	arrayContainsObject: function(arr, obj){
		
		var i = arr.length;
	    while (i--) {
	        if (arr[i] == obj) {
	            return true;
	        }
	    }
	    return false;
	},
	
	/**
	 * Save user selection/range object in the following format (as Base64 encoded)
	 * rangeStartContainer :: Relation , rangeEndContainer :: Relation , rangeEndContainerOffset , rangeEndContainerOffset
	 * 
	 * @param RangeObject rangeObj
	 * @param HTMLDocument doc - this document contains the rangeObj
	 * TODO: StartContainer/EndContainer = <span class='highlight'> ? 
	 */
	
	saveSelection: function( rangeObj, doc ){				
		
		var rangeStartContainer, rangeEndContainer, rangeStartContainerRelation, rangeEndContainerRelation, rangeStartContainerOffset, rangeEndContainerOffset, dataOffsetValues;
		
		/* If startContainer or endContainer is <span class='highlight'> */
		if(rangeObj.startContainer.nodeType === 1 && rangeObj.startContainer.className.indexOf("highlight ") > -1){
			rangeObj.startContainer = rangeObj.startContainer.childNodes[0];
			rangeObj.startOffset = 0;
		}
		
		
		if(rangeObj.startContainer.nodeType === 1){
			rangeStartContainer = this.getXPath(rangeObj.startContainer);
			rangeStartContainerRelation = "null";
			rangeStartContainerOffset = rangeObj.startOffset;	
		}
		else if(rangeObj.startContainer.nodeType === 3){
			if(rangeObj.startContainer.parentNode.className.indexOf("highlight ") !== -1){
								
				var dataOffsetValues = base64.decode(doc.getElementById(rangeObj.startContainer.parentNode.className.split(" ")[1]).getAttribute("data-offset")).split("|");
				
				rangeStartContainer = dataOffsetValues[3];
				rangeStartContainerRelation = dataOffsetValues[2];
				rangeStartContainerOffset = dataOffsetValues[0];
							
			} else {
				if(rangeObj.startContainer.previousSibling){
					if(rangeObj.startContainer.previousSibling.className.indexOf("highlight ") !== -1){
						
						var dataOffsetValues = base64.decode(rangeObj.startContainer.previousSibling.getAttribute("data-offset")).split("|");
						rangeStartContainer = dataOffsetValues[3];
						rangeStartContainerRelation = dataOffsetValues[2];
						rangeStartContainerOffset = parseInt(dataOffsetValues[1]) + rangeObj.startOffset;
						
					} else {
						rangeStartContainer = this.getXPath(rangeObj.startContainer.previousSibling);
						rangeStartContainerRelation = "prevSib";
						rangeStartContainerOffset = rangeObj.startOffset;					
					}					
				} else {
					rangeStartContainer = this.getXPath(rangeObj.startContainer.parentNode);
					rangeStartContainerRelation = "parentNode";
					rangeStartContainerOffset = rangeObj.startOffset;				
				}			
			}
		}
		
		if(rangeObj.endContainer.nodeType === 1){
			rangeEndContainer = this.getXPath(rangeObj.endContainer);
			rangeEndContainerRelation = "null";
			rangeEndContainerOffset = rangeObj.endOffset;			
		}
		else if(rangeObj.endContainer.nodeType === 3){
			
			if(rangeObj.endContainer.parentNode.className.indexOf("highlight ") !== -1){			
				
				var elmentsWithEndContainerClass = doc.getElementsByClassName(rangeObj.endContainer.parentNode.className.split(" ")[1]);
				
				var dataOffsetValues = base64.decode(elmentsWithEndContainerClass[elmentsWithEndContainerClass.length - 1].getAttribute("data-offset")).split("|");
				rangeEndContainer = dataOffsetValues[3];
				rangeEndContainerRelation = dataOffsetValues[2];
				rangeEndContainerOffset = dataOffsetValues[1];
			
			} else {
				if(rangeObj.endContainer.previousSibling){
					if((typeof rangeObj.endContainer.previousSibling.className != 'undefined') && (rangeObj.endContainer.previousSibling.className.indexOf("highlight ") !== -1)){
						
						var dataOffsetValues = base64.decode(rangeObj.endContainer.previousSibling.getAttribute("data-offset")).split("|");
						rangeEndContainer = dataOffsetValues[3];
						rangeEndContainerRelation = dataOffsetValues[2];
						rangeEndContainerOffset = parseInt(dataOffsetValues[1]) + rangeObj.endOffset;						
					} else {
						rangeEndContainer = this.getXPath(rangeObj.endContainer.previousSibling);
						rangeEndContainerRelation = "prevSib";
						rangeEndContainerOffset = rangeObj.endOffset;					
					}					
				} else {
					rangeEndContainer = this.getXPath(rangeObj.endContainer.parentNode);
					rangeEndContainerRelation = "parentNode";
					rangeEndContainerOffset = rangeObj.endOffset;				
				}			
			}
		}
		Hilite.savedSelectionWithoutBase64 = rangeStartContainer + "::" + rangeStartContainerRelation + "," + rangeEndContainer + "::" + rangeEndContainerRelation + "," + rangeStartContainerOffset + "," + rangeEndContainerOffset;
		return base64.encode(rangeStartContainer + "::" + rangeStartContainerRelation + "," + rangeEndContainer + "::" + rangeEndContainerRelation + "," + rangeStartContainerOffset + "," + rangeEndContainerOffset);
	},
	
	/**
	 * @param RangeObject rangeObj
	 * @param HTMLDocument doc
	 * @param String className - class to be added to the textNodes
	 * @return String Hilite.saveSelection OR "invalid:message" 
	 */
	
	getNodesInRange: function (rangeObj, doc, className){				
		
		this.xpaths = []; /* NR - array of XPATH addresses */
		this.removeClasses = []; /* Merged classes, needs to be removed */
		var range = rangeObj, 			
		 	nodes = [],  /* Collection of text nodes to be wrapped */
			mergeClasses = [], /* NR - Elements are objects {"className": classHighlight[1], "element": node, "position": position} */
			newStartContainer = false, 
			newEndContainer = false, 
			mergeClassesSeen = []; /* To maintain uniqueness of merged classes */
		
		/* When documnet body gets selected */
		if(navigator.userAgent.toLowerCase().indexOf("ipad") > -1 || navigator.userAgent.toLowerCase().indexOf("iphone") > -1){
			if(range.startContainer === doc.body || range.endContainer === doc.body){
				return "invalid: <body> selected";
			}		
		}
			
		
		/* start container or end container is null logic */
		if(range.startContainer === null && range.endContainer === null){
			return "invalid: (SC,EC)=NULL";
		}		
		else if(range.startContainer === null){
			range.startContainer = range.endContainer;
		}
		else if(range.endContainer === null){
			range.endContainer = range.startContainer;
		}
		
		/* fix for firefox - when the selected region has endContainer before the startContainer (or) has "\n\t" text nodes*/
		var nodesBeforeStartContainer = [];
		for (var node = doc.getElementsByTagName('body')[0], i=0; node; node = this.getNextNode(node)){
			if(node === range.startContainer){ 
				break;
			}
			else{ 				
				nodesBeforeStartContainer[i] = node;
				i++;
			}			
		}
		if(Hilite.arrayContainsObject(nodesBeforeStartContainer, range.endContainer)){					
			range.setEnd(range.startContainer, range.endOffset);
		}
		
		if(range.endContainer.nodeType === 3){
			var tempEndNode = range.endContainer.nodeValue.replace(/[\t\n\r]/g, "");
			if(tempEndNode.length === 0){				
				//range.setEnd(range.startContainer, range.endOffset);
				range.setEnd(range.startContainer, range.startContainer.length);
			} 
		}
		/* end of fix */
		
		/* save user selection */
		if(Hilite.merge){
			var savedSelection = this.saveSelection(range,doc);
		}
		
		// populate nodes[] & mergeClasses[]
		for (var node = range.startContainer,position=0; node; node = this.getNextNode(node)) {		   
		    
			if(node.nodeType === 3){ /* text nodes which does not belong to SVG <text> */
			
				/* filter out text nodes with escape sequences */
				var nodeLength = node.nodeValue.replace(/[ \t\n\r]/g, "");				
				if(nodeLength.length === 0){					
					continue;
				}			 					
					
				var classHighlight = ['null','null'];
				if(node.parentNode.className){					
					//classHighlight =  node.parentNode.getAttribute('class').split(" ");
					classHighlight =  node.parentNode.getAttribute('class') !== undefined ? node.parentNode.getAttribute('class').split(" ") : ["",""];					
				}					
				
				if(classHighlight[0] === 'highlight'){ // push the data-offset values of nodes with "highlight" to the xpaths[]
					
					if(!Hilite.arrayContainsObject(mergeClassesSeen, classHighlight[1])){
						mergeClasses.push({"className": classHighlight[1], "element": node, "position": position});					
						position = position + doc.querySelectorAll('.' + classHighlight[1]).length;
						mergeClassesSeen.push(classHighlight[1]);
					}
					
				}else{	// push textNodes not wrapped in nodes with "highlight" class to nodes[]
					
					/* if the text is child node of <text> of <svg>, type: svg */
		    		if(node.parentNode.nodeName === "text")
		    			nodes.push({"type":"svgText", "element": node, "position": position++});
					else
						nodes.push({"type":"default", "element": node, "position": position++});					
				}
			}	 
			
			// if the nodes in selection contain the "highlight" class then its a merge operation								        
		    if (node == range.endContainer)
		      	break;
		}
		
		if(mergeClasses.length > 0 && Hilite.merge === true){
			
			this.removeClasses = this.getUniqueClasses(mergeClasses);
			// 1. replace the 2nd class of nodes with highlight class with the new class
			for(var i = 0; i < mergeClasses.length; i++) { //alert(mergeClasses.length);
				
				var replaceClassArray = [],replaceClassArrayLength;
				// using temporary array to get all elements with the merge "classname" and then loading the values into 
				// another array to replace the classes, since the elements of this array change DYNAMICALLY on REPLACING the CLASSNAMES   				
				var tempReplaceClassArray = doc.querySelectorAll('.' + mergeClasses[i].className); 
				 
				for(var j=0; j<tempReplaceClassArray.length; j++){
					replaceClassArray[j] = tempReplaceClassArray[j];
				}
					
				replaceClassArrayLength = replaceClassArray.length;  //alert(replaceClassArrayLength);
				
				for(var k = 0; k < replaceClassArrayLength; k++ ) { //alert(k);
					//this.xpaths.push(replaceClassArray[k].getAttribute("data-offset"));
					replaceClassArray[k].setAttribute('class', 'highlight ' + className);
					this.xpaths[mergeClasses[i].position + k] = replaceClassArray[k].getAttribute("data-offset");
					//this.xpaths[mergeClasses[i].position + k] = mergeClasses[i].element.parentNode.getAttribute("data-offset");
					//mergeClasses[i].element.parentNode.setAttribute('class', 'highlight ' + className);					
				}
				/* Replcae ID too*/
				doc.querySelector('#' + mergeClasses[i].className).setAttribute('id', className);
			}
		}
		
		//Here the selection is a subset of the existing selection
		if(nodes.length === 0) {
			if(mergeClasses.length !== 0){
				if(Hilite.merge === true){//return the selection if it is the duplicate of an existing, before returning
					return savedSelection;
				}else{    
					return;
				}
			}else{
				return "invalid: no text";
			}		
		} 
		
		// identify if merge has a new start/stop container
		if(range.startContainer === nodes[0].element)
			newStartContainer = true;
		if(range.endContainer === nodes[nodes.length - 1].element)				
			newEndContainer = true;
			
		// 2. Change the range Object
		if((newStartContainer === true) && (newEndContainer === false)){
			range.setStart(nodes[0].element, range.startOffset);
			range.setEnd(nodes[nodes.length - 1].element, nodes[nodes.length - 1].element.length);
		}	
		else if((newStartContainer === false) && (newEndContainer === true)){
			range.setStart(nodes[0].element, 0);
		}
		else if((newStartContainer === false) && (newEndContainer === false)){ //merge is in between selections
		 	range.setStart(nodes[0].element, 0);
		 	range.setEnd(nodes[nodes.length - 1].element, nodes[nodes.length - 1].element.length);
		}	
		
	     //1. If range.startContainer == range.endContainer, then slection made within the same Element
	    	 // also in case of merge highlight, this condition would fail
	    //if(range.startContainer == range.endContainer){or
	    if(nodes.length === 1){ 	
	    		
	    	var startOffset,endOffset,xpathValues,xpath;
	    	
	    	if(range.startContainer.previousSibling){
				//check for "highlight" class
				//var classHighlight =  range.startContainer.previousSibling.getAttribute('class').split(" ");
				var classHighlight =  (range.startContainer.previousSibling.getAttribute('class') !== null) ? 
				    							  range.startContainer.previousSibling.getAttribute('class').split(" ") :
				    							  [null];
				if(classHighlight[0] === 'highlight') {
					
									
					xpathValues = range.startContainer.previousSibling.getAttribute("data-offset");
					xpathValues = base64.decode(xpathValues).split("|");					
					startOffset = range.startOffset + parseInt(xpathValues[1]);					
					endOffset = range.endOffset + parseInt(xpathValues[1]);
					relation = xpathValues[2];			
					xpath = xpathValues[3];
						
				}
				
				else{
				
					startOffset = range.startOffset;
					endOffset = range.endOffset;	
					relation = "prevSib";			
					xpath = this.getXPath(range.startContainer.previousSibling);
								
				}
			}
			
			else{
				
				startOffset = range.startOffset;
				endOffset = range.endOffset;
				relation = "parentNode";			
				xpath = this.getXPath(range.startContainer.parentNode);
			}			
			
			var dataOffset = startOffset+ "|" + endOffset + "|" + relation + "|" + xpath;			
			
			if(window.getSelection){
				
				if(nodes[0].type === "svgText"){
					var newNode = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
					newNode.setAttribute('class', 'highlight ' + className);
				}				
				else{
					var newNode = doc.createElement(Hilite.hiliteTag);
					newNode.className = newNode.className + "highlight " + className;
				}				
				
				// Split the text			
				var text1 = nodes[0].element.nodeValue.substr(0, range.startOffset);
				var text2 = nodes[0].element.nodeValue.substr(range.startOffset, range.endOffset - range.startOffset);
				var text3 = nodes[0].element.nodeValue.substr(range.endOffset);				
				
				newNode.appendChild(doc.createTextNode(text2));				
				newNode.setAttribute('data-offset', base64.encode(dataOffset));	
				
				//range.deleteContents();
				//range.insertNode(newNode);								    		
						                                                                                                                                                                                                          
				// Replace with existing text
				nodes[0].element.parentNode.replaceChild(newNode, nodes[0].element);
				
				// Put text1 before newNode
				if(text2.length > 0){
					newNode.parentNode.insertBefore(doc.createTextNode(text1),newNode);
				}				
				
				// Put text3 before newNode
				if(text3.length > 0){
					if (newNode.nextSibling) {
					 	newNode.parentNode.insertBefore(doc.createTextNode(text3), newNode.nextSibling);
					}
					else {
						newNode.parentNode.appendChild(doc.createTextNode(text3));
					}
					
				}
			}
			else if(window.document.selection){
				var rangeIE = doc.selection.createRange();				
				rangeIE.pasteHTML("<span class='highlight "+ className +"' data-offset="+ base64.encode(dataOffset)+">"+ rangeIE.text+"</span");				
			}
			
			this.xpaths[nodes[0].position] = base64.encode(dataOffset);
	    }
	    
	    //2. If start.parentNode != end.parentNode, then slection made across multiple Elements
	    
	    else {
		    
		    // a. extract all the nodes within the selection(in case of merge only the un-highlighted nodes) - already extracted in nodes[]		    
		    
		    // b. apply highlight to all the selected text nodes # except <textNode>\n</textNode>
		    
		    for(var i=0; i<nodes.length; i++){
		    	if(nodes[i].element.nodeType == 3){    		
		    		
		    		//alert(nodes[i].nodeValue.charCodeAt(0));
		    		//To eliminate textNode's with a newline nodeValue
		    		//if((nodes[i].nodeValue === "\t\t\n\t\t") || (nodes[i].length <= 0))
		    		//if((nodes[i].nodeValue.indexOf("\t\t\n\t\t") !== -1) || (nodes[i].length <= 0))		    		
		    		//if((nodes[i].nodeValue === "\t\t\n\t\t") || (nodes[i].length <= 0) || (nodes[i].nodeValue === "\n\t\t\n\t\t") || (nodes[i].nodeValue === "\n\t\t"))
		    		//var tempNode = nodes[i].nodeValue.replace(/[\t\n\r]/g, "");
		    		//if(tempNode.length === 0){
		    			//continue;
		    		//} 	 
		    		
					
					if(i==0){ // 1st node - begin from startOffset
						var startOffset = range.startOffset,xpathValues,relation,xpath;
						var parent = nodes[i].element.parentNode; 
						// Split the text			
						var text1 = nodes[i].element.nodeValue.substr(0, startOffset);
						var text2 = nodes[i].element.nodeValue.substr(startOffset);
						
						//############################Check for existing SPANS(.highlight) #############################
						
				    	if(nodes[i].element.previousSibling){
				    		
				    						    		
				    		//check for "highlight" in previous node
				    		//var classHighlight =  nodes[i].element.previousSibling.getAttribute('class').split(" ");
				    		var classHighlight =  ((typeof nodes[i].element.previousSibling.getAttribute === 'function') && (nodes[i].element.previousSibling.getAttribute('class') !== null)) ? 
				    							  nodes[i].element.previousSibling.getAttribute('class').split(" ") :
				    							  [null];							
							if(classHighlight[0] === 'highlight'){
								
								xpathValues = nodes[i].element.previousSibling.getAttribute("data-offset");	
								xpathValues = base64.decode(xpathValues).split("|");			
								startOffset = range.startOffset + parseInt(xpathValues[1]);	
								endOffset = parseInt(xpathValues[1]) + nodes[i].element.length;
								relation = xpathValues[2];
								xpath = xpathValues[3];				
								//endOffset = range.endOffset + parseInt(startEndRange[1]);	
							}
							else{
								
								startOffset = range.startOffset;
								endOffset = nodes[i].element.length;
								relation = "prevSib";
								xpath = this.getXPath(nodes[i].element.previousSibling);
								//endOffset = range.endOffset;				
							}
						}
						else{
							
							startOffset = range.startOffset;
							endOffset = nodes[i].element.length;
							relation = "parentNode";
							xpath = this.getXPath(nodes[i].element.parentNode);
							//endOffset = range.endOffset;
						}
						//###################################################################################						
						//wrap the slected text
						//var wrapper = doc.createElement('span');
						if(nodes[i].type === "svgText"){
							var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
							wrapper.setAttribute('class', 'highlight ' + className);
						}				
						else{
							var wrapper = doc.createElement(Hilite.hiliteTag);
							wrapper.className = wrapper.className + "highlight " + className;
						}			
						
						
										
						// set element as child of wrapper
					    wrapper.appendChild(doc.createTextNode(text2));				    		
						                                                                                                                                                                                                          
						// Replace with existing text
						parent.replaceChild(wrapper, nodes[i].element);
						
						// Put text1 before wrapper
						parent.insertBefore(doc.createTextNode(text1),wrapper);
						
						//set class, id and data-offset
					    //wrapper.className = wrapper.className + "highlight " + className;			
					     	    
					    var dataOffset = startOffset+ "|" + endOffset + "|" + relation + "|" + xpath;	//EOE - End Of Element 		
					    wrapper.setAttribute('data-offset', base64.encode(dataOffset));    
					    this.xpaths[nodes[i].position] = base64.encode(dataOffset);					
						
					}
					
					else if(i == (nodes.length - 1)) { //last node - stop at endOffset
						
						var endOffset = range.endOffset, relation, xpath;
						var parent = nodes[i].element.parentNode; 
						// Split the text			
						var text1 = nodes[i].element.nodeValue.substr(0, endOffset);
						var text2 = nodes[i].element.nodeValue.substr(endOffset);
						
						//############################ Get offsets|relation|xpath for the last element #############################c						
						//############################Check for existing SPANS(.highlight) #############################
						
				    	if(nodes[i].element.previousSibling){				    		
				    						    		
				    		//check for "highlight" in previous node
				    		var classHighlight =  ((typeof nodes[i].element.previousSibling.getAttribute === 'function') && (nodes[i].element.previousSibling.getAttribute('class') !== null)) ? 
				    							  nodes[i].element.previousSibling.getAttribute('class').split(" ") :
				    							  [null];
				    		
				    									
							if(classHighlight[0] === 'highlight'){
								
								xpathValues = nodes[i].element.previousSibling.getAttribute("data-offset");	
								xpathValues = base64.decode(xpathValues).split("|");	
								startOffset = parseInt(xpathValues[1]);
								endOffset = range.endOffset + parseInt(xpathValues[1]);							
								relation = xpathValues[2];
								xpath = xpathValues[3];				
								//endOffset = range.endOffset + parseInt(startEndRange[1]);	
							}
							else{	
								
								startOffset = 0;
								endOffset = range.endOffset;
								relation = "prevSib";
								xpath = this.getXPath(nodes[i].element.previousSibling);
								//endOffset = range.endOffset;				
							}
						}
						else{
							startOffset = 0;
							endOffset = range.endOffset;
							relation = "parentNode";
							xpath = this.getXPath(nodes[i].element.parentNode);
							//endOffset = range.endOffset;
						}
						//###################################################################################				    	
						//###################################################################################
						
						
						//wrap the slected text
						//var wrapper = doc.createElement('span');
						if(nodes[i].type === "svgText"){
							var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
							wrapper.setAttribute('class', 'highlight ' + className);
						}				
						else{
							var wrapper = doc.createElement(Hilite.hiliteTag);
							wrapper.className = wrapper.className + "highlight " + className;
						}			
						
										
						// set text1 as child of wrapper
					    wrapper.appendChild(doc.createTextNode(text1));
					    
					    // Replace with existing  text
						parent.replaceChild(wrapper, nodes[i].element);
						
						// append text2 to the wrapper
						parent.insertBefore(doc.createTextNode(text2),wrapper.nextSibling);
						
						//set class and data-offset attr
					    //wrapper.className = wrapper.className + "highlight " + className;
					    
					    var dataOffset =  startOffset + "|" + endOffset + "|" + relation + "|" + xpath;
					    wrapper.setAttribute('data-offset', base64.encode(dataOffset));     
					    this.xpaths[nodes[i].position] = base64.encode(dataOffset);
					}
					
					else {   // else apply full highlight 
						
						var parent = nodes[i].element.parentNode, relation, xpath; 				
						
						//############################ Get relation|xpath for the inbetween elements #############################					
						//############################Check for existing SPANS(.highlight) #############################
						
				    	if(nodes[i].element.previousSibling){				    		
				    						    		
				    		//check for "highlight" in previous node
				    		var classHighlight =  ((typeof nodes[i].element.previousSibling.getAttribute === 'function') && (nodes[i].element.previousSibling.getAttribute('class') !== null)) ? 
				    							   nodes[i].element.previousSibling.getAttribute('class').split(" ") : 
				    							   [null];							
							if(classHighlight[0] === 'highlight') {
								
								xpathValues = nodes[i].element.previousSibling.getAttribute("data-offset");	
								xpathValues = base64.decode(xpathValues).split("|");
								startOffset = parseInt(xpathValues[1]);			
								endOffset = startOffset + nodes[i].element.length;						
								relation = xpathValues[2];
								xpath = xpathValues[3];				
								//endOffset = range.endOffset + parseInt(startEndRange[1]);	
							}
							else{								
								
								startOffset = 0;			
								endOffset = nodes[i].element.length;
								relation = "prevSib";
								xpath = this.getXPath(nodes[i].element.previousSibling);
								//endOffset = range.endOffset;				
							}
						}
						else{
							
							startOffset = 0;			
							endOffset = nodes[i].element.length;
							relation = "parentNode";
							xpath = this.getXPath(nodes[i].element.parentNode);
							//endOffset = range.endOffset;
						}
						//###################################################################################			    	
						
						//wrap the slected text
						//var wrapper = doc.createElement('span');
						if(nodes[i].type === "svgText"){
							var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
							wrapper.setAttribute('class', 'highlight ' + className);
						}				
						else{
							var wrapper = doc.createElement(Hilite.hiliteTag);
							wrapper.className = wrapper.className + "highlight " + className;
						}			
						
							
						// set the wrapper as child (instead of the element)
						parent.replaceChild(wrapper, nodes[i].element);
							
						// set element as child of wrapper
					    wrapper.appendChild(nodes[i].element);
					    
					    //set class and data-attr
					    //wrapper.className = wrapper.className + "highlight " + className;
					     
					    var dataOffset = startOffset + "|" + endOffset + "|" + relation + "|" + xpath;
					    wrapper.setAttribute('data-offset', base64.encode(dataOffset));        //EOE - End Of Element
					    this.xpaths[nodes[i].position] = base64.encode(dataOffset);
			      }
			   }
		    }
		}
		
		/* ADD ID TO THE FIST TEXT NODE */
		doc.getElementsByClassName(className)[0].setAttribute('id', className.split(" ")[0]);
		//Hilite.log(nodes);
		//var serializedString = "";
		//for(var i=0; i < this.xpaths.length; i++)
			 //serializedString += this.xpaths[i] + ",";
		//return serializedString;	  
		
		return savedSelection;     	
	},
	
	getNodesInDocument: function (doc, className, endOfWord){
		//create range object from the selection in window
		var range;
		if (window.getSelection) { // Firefox/Chrome/Safari/Opera/IE9
			range = doc.getSelection().getRangeAt(0);
			
			/* If endOfWord === true, extend the range to the endOfWord - added for android notes*/
			if ((endOfWord === true) && (range.endContainer.nodeType === 3)) {
				if(range.endContainer.nodeValue.charCodeAt(range.endOffset - 1) === 32) {
					range.setEnd(range.endContainer, range.endOffset - 2);					
				}else{
					var rangeEndoffsetIncrementConter = 0, nxtChar = range.endContainer.nodeValue.charCodeAt(range.endOffset); 
					while((nxtChar !== 32) && (nxtChar <= range.endContainer.length)) {						
						++rangeEndoffsetIncrementConter;
						nxtChar = range.endContainer.nodeValue.charCodeAt(range.endOffset + rangeEndoffsetIncrementConter);						
					}						
					range.setEnd(range.endContainer, range.endOffset + rangeEndoffsetIncrementConter);
				}
			}
			if ((endOfWord === true) && (range.startContainer.nodeType === 3)) {
				if(range.startContainer.nodeValue.charCodeAt(range.startOffset) === 32) {
					range.setStart(range.startContainer, range.startOffset + 1);					
				}
				else{
					var rangeStartoffsetDecrementConter = 0, prvChar = range.startContainer.nodeValue.charCodeAt(range.startOffset - 1); 
					while((prvChar !== 32) && (prvChar >= 0)) {						
						++rangeStartoffsetDecrementConter;
						prvChar = range.startContainer.nodeValue.charCodeAt(range.startOffset - rangeStartoffsetDecrementConter);						
					}						
					range.setStart(range.startContainer, range.startOffset - rangeStartoffsetDecrementConter + 1);
				}
			}
			
			
		}
		else if(window.document.selection) { // IE8
			var rangeIE = doc.selection.createRange(); //Microsoft TextRange Object
			range = this.fixIERangeObject(rangeIE); 
		}
		
		var returnValue = this.getNodesInRange(range, doc, className);
		if(returnValue !== undefined) {return returnValue;}
	},
	
	applySelectionToDOM: function (doc, value, className){
		
				
		var xpathValues, startOffset, endOffset, relation, xpath;
		
		xpathValues = base64.decode(value).split("|");			
		startOffset = parseInt(xpathValues[0]);		
		endOffset = parseInt(xpathValues[1]);	
		relation = xpathValues[2];
		xpath = xpathValues[3];
		
		//Traverse through the DOM using xpath
		var element = this.getElementFromXPath(doc,xpath);
        
        // To check if there are span's injected into the textNode following the "element", which may interfere with the offsets
        
        var textNode;	
    	if(relation === "parentNode")
			textNode = element.childNodes[0];
		else if(relation === "prevSib")
			textNode = element.nextSibling;
		
		var overlapHilit = false;
		//step 1. check if offsets are available in the textNode
		var nodeLength = textNode.length;
		
		
		if(nodeLength < startOffset){			
       		
       		//step 2. check for spans/other elements with class='highlight'	
       		var classHighlight =  textNode.nextSibling.getAttribute('class').split(" ");							
								
			if(classHighlight[0] === 'highlight') {				
				
				//step 3. change "element", offset value and relation
				do{
					element = textNode.nextSibling;
					//console.log(textNode.nextSibling.getAttribute("data-offset"));					 
					
					spanXpathValues = textNode.nextSibling.getAttribute("data-offset");	
					spanXpathValues = base64.decode(spanXpathValues).split("|");			
					var spanStartOffset = parseInt(spanXpathValues[0]);	
					var spanEndOffset = parseInt(spanXpathValues[1]);
					
					textNode = element.nextSibling;
					
					if(startOffset <= spanEndOffset){
						overlapHilit = true;
						break;			
					}					
					//textNode = element.nextSibling;
				}	
				while ((startOffset > spanEndOffset) && (endOffset > (spanEndOffset + element.nextSibling.length)));
				
				//changing offset and relation value				
				if(!overlapHilit){
					relation = "prevSib"	//<span>textNode -> prevSib
					startOffset = startOffset - spanEndOffset;
					endOffset = endOffset - spanEndOffset;
				}
				else{
					//alert("Overlapping highlight's, please check !");
					
					if(endOffset <= spanEndOffset) //if the overlapping region lies within the span, ignore the highlight
						return;
							
					else{						//if the overlapping region lies beyond the span, change the offsets
						relation = "prevSib"	//<span>textNode -> prevSib
						startOffset = 0;
						endOffset = endOffset - spanEndOffset;
					}
				}
			}
				
		}		
		
		//alert if only a part of the node can be highlighted due to overlapping
		if(nodeLength < (startOffset - endOffset)) 
			{;}//alert("Overlapping highlight's, please check !");
		//alert(element);
		//check relation and apply offsets
		if(relation === "parentNode"){
			var textNode = element.childNodes[0];
			var text1 = textNode.nodeValue.substr(0, startOffset);
			var text2 = textNode.nodeValue.substr(startOffset,(endOffset - startOffset));
			var text3 = textNode.nodeValue.substr(endOffset);
			
		
			//wrapper for the selected text
			if(textNode.parentNode.nodeName === "text"){
				var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
				wrapper.setAttribute('class', 'highlight ' + className);
			}
			else{
				var wrapper = doc.createElement(Hilite.hiliteTag);
				wrapper.className = wrapper.className + "highlight " + className;
			}
						
			
			// Replace with text node
			element.replaceChild(wrapper, textNode);
							
			// set element as child of wrapper
		    wrapper.appendChild(doc.createTextNode(text2));
		    
		    // Put text1 before wrapper
			element.insertBefore(doc.createTextNode(text1),wrapper);
			
			// Put text3 after wrapper
			element.insertBefore(doc.createTextNode(text3),wrapper.nextSibling);
		    
		    //set class and data-offset
		    //wrapper.className = wrapper.className + "highlight " + className;
		    	    
		    	
		    wrapper.setAttribute('data-offset', value); 
		
		}
		
		else if(relation === "prevSib"){
			//alert(element.nextSibling.nodeValue);
			var textNode = element.nextSibling;
			var text1 = textNode.nodeValue.substr(0, startOffset);
			var text2 = textNode.nodeValue.substr(startOffset,(endOffset - startOffset));
			var text3 = textNode.nodeValue.substr(endOffset);
			
		
			//wrapper for the selected text
			//var wrapper = doc.createElement('span');
			if(textNode.parentNode.nodeName === "text"){
				var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
				wrapper.setAttribute('class', 'highlight ' + className);
			}
			else{
				var wrapper = doc.createElement(Hilite.hiliteTag);
				wrapper.className = wrapper.className + "highlight " + className;
			}
			
			
			// Replace with text node
			element.parentNode.replaceChild(wrapper, textNode);
							
			// set element as child of wrapper
		    wrapper.appendChild(doc.createTextNode(text2));
		    
		    // Put text1 before wrapper
			element.parentNode.insertBefore(doc.createTextNode(text1),wrapper);
			
			// Put text3 after wrapper
			element.parentNode.insertBefore(doc.createTextNode(text3),wrapper.nextSibling);
		    
		    //set class and data-offset
		    //wrapper.className = wrapper.className + "highlight " + className;
		      
		    	
		    wrapper.setAttribute('data-offset', value); 
		}
		
		else{
			Hilite.log("Invalid Xpath");
		}		
	},
	
	applyHighlight: function (doc, serializedStr, className){			
		
		if(serializedStr.indexOf(",") !== -1){//applyHilight1
			var array = serializedStr.split(",");
			for(var i = 0; i < (array.length-1) ; i++)
				this.applySelectionToDOM(doc, array[i], className);
		}
		else{
			Hilite.applyHighlight2(doc, serializedStr, className);
		}
	},
	
	removeClassesSerialized: function(){

		var array = this.removeClasses;
		var serializedRemovedClasses = "";
	
		for(var i = 0 ; i < array.length; i++){
			
			if(serializedRemovedClasses.length > 0){
				serializedRemovedClasses = serializedRemovedClasses + "::" + array[i];
			}else{
				serializedRemovedClasses = array[i];
			}
		}
		return serializedRemovedClasses;
	},
	
	removeHilite: function (element, className) {
		if (element) {
			if (element.nodeType == 1) {
				if (element.getAttribute("class") !== null && element.getAttribute("class").indexOf(className) !== -1) {
					var text = element.removeChild(element.firstChild);
					element.parentNode.insertBefore(text,element);
					element.parentNode.removeChild(element);
					return true;
				} else {
					var normalize = false;
					for (var i = element.childNodes.length-1; i>=0; i--) {
						if (Hilite.removeHilite(element.childNodes[i], className)) {
							normalize = true;
						}
					}
					if (normalize) {
						if(navigator.userAgent.indexOf('rv:11') === -1) {
							element.normalize();	
						} else {
							Hilite.normalize(element); //custom implementation of normalize method
						}
					}
				}
			}
		}
		return false;
	},

	
	applyHighlight2: function(doc, serializedStr, className){
		
		var rangeParams = base64.decode(serializedStr).split(",");
		var startOffset = parseInt(rangeParams[2]);
		var endOffset = parseInt(rangeParams[3]);
		
		var startContainerRelation = rangeParams[0].split("::")[1];
		var endContainerRelation = rangeParams[1].split("::")[1];
		
		var startContainer, endContainer;
		
		if(startContainerRelation !== "null"){
			startContainer = rangeParams[0].split("::")[1] === "prevSib" ? this.getElementFromXPath(doc,rangeParams[0].split("::")[0]).nextSibling
																		  : this.getElementFromXPath(doc,rangeParams[0].split("::")[0]).childNodes[0];
			
			if(startContainer.nodeType === 1 && startContainer.className.split(" ")[0] === "highlight"){
				startContainer = startContainer.childNodes[0];
			}
			
			//step 1. check if offsets are available in the textNode				
			if(startContainer.length <= startOffset){ 
				var shiftedStart = Hilite.shiftContainerAndOffset(startContainer, startOffset);
				startContainer = shiftedStart.shiftedContainer;
				startOffset = shiftedStart.shiftedOffset;
			}
		}else{
			startContainer = this.getElementFromXPath(doc,rangeParams[0].split("::")[0]);
		}
			
		if(endContainerRelation !== "null"){
			
			endContainer = rangeParams[1].split("::")[1] === "prevSib" ? this.getElementFromXPath(doc,rangeParams[1].split("::")[0]).nextSibling
																		  : this.getElementFromXPath(doc,rangeParams[1].split("::")[0]).childNodes[0];
			
			if(endContainer.nodeType === 1 && endContainer.className.split(" ")[0] === "highlight"){
				endContainer = endContainer.childNodes[0];
			}					
				
			//step 1. check if offsets are available in the textNode			
			if(endContainer.length < endOffset){
				var shiftedEnd = Hilite.shiftContainerAndOffset(endContainer, endOffset);
				endContainer = shiftedEnd.shiftedContainer;
				endOffset = shiftedEnd.shiftedOffset;     		
			}	
		} else{
			endContainer = this.getElementFromXPath(doc,rangeParams[1].split("::")[0]);
		}
		
		
		var rangeObj = doc.createRange();
		rangeObj.setStart(startContainer,startOffset);
		rangeObj.setEnd(endContainer,endOffset);
		Hilite.merge = false;
		this.getNodesInRange(rangeObj, doc, className);
		Hilite.merge = true;
	},
	
	shiftContainerAndOffset: function(container, offset){			
					      		
		var textNode = container;	
		
   		//step 2. check for spans/other elements with class='highlight'	
   		//var classHighlight =  textNode.nextSibling.getAttribute('class').split(" ");
   		var classHighlight = textNode.nextSibling.getAttribute('class') !== undefined ? textNode.nextSibling.getAttribute('class').split(" ") : ["",""];							
							
		if(classHighlight[0] === 'highlight') {				
			var hiliteOverlap = false;
			//step 3. change "element", offset value
			do{
				var element = textNode.nextSibling;				
				
				var spanXpathValues = textNode.nextSibling.getAttribute("data-offset");	
				spanXpathValues = base64.decode(spanXpathValues).split("|");			
				var spanStartOffset = parseInt(spanXpathValues[0]);	
				var spanEndOffset = parseInt(spanXpathValues[1]);						
				
				if(offset <= spanEndOffset){														
					hiliteOverlap = true;
					break;			
				}					
				textNode = element.nextSibling;		
				
			}	
			while ((offset > (spanEndOffset + element.nextSibling.length)));
			// Note: structure of multiple spans in a text node is <TN><span><TN><span><TN><span>.. alaways 
			
			if (!hiliteOverlap) {offset = offset - spanEndOffset; container = textNode;}
			else {offset = offset - spanStartOffset; container = element.childNodes[0];}				
			
			return {shiftedContainer:container, shiftedOffset: offset};
		}	
	},
	
	/**
	 * Custom implementation of normalize method
	 * @param DOMElement - having broken child text nodes. 
	 */
	normalize: function(ele) {
		var childEle = ele.childNodes,
			found = false,	i = 0;
					
		while(i < childEle.length){
			if(childEle[i].nodeType === 3){
				if(found){
					 childEle[i - 1].nodeValue =  childEle[i - 1].nodeValue + childEle[i].nodeValue;
					 childEle[i].parentNode.removeChild(childEle[i]);
				} else {
					found = true; i++;						
				}
				
			} else {
				found = false; i++;
			}
			
		}		
	}
};


/** base64 to string conversion and vice-versa*/
var base64 = {};
base64.PADCHAR = '=';
base64.ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

base64.makeDOMException = function() {
    // sadly in FF,Safari,Chrome you can't make a DOMException
    var e, tmp;

    try {
        return new DOMException(DOMException.INVALID_CHARACTER_ERR);
    } catch (tmp) {
        // not available, just passback a duck-typed equiv
        // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Error
        // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Error/prototype
        var ex = new Error("DOM Exception 5");

        // ex.number and ex.description is IE-specific.
        ex.code = ex.number = 5;
        ex.name = ex.description = "INVALID_CHARACTER_ERR";
		
		// Safari/Chrome output format
        ex.toString = function() { return 'Error: ' + ex.name + ': ' + ex.message; };
        return ex;
    }
}

base64.getbyte64 = function(s,i) {
    // This is oddly fast, except on Chrome/V8.
    //  Minimal or no improvement in performance by using a
    //   object with properties mapping chars to value (eg. 'A': 0)
    var idx = base64.ALPHA.indexOf(s.charAt(i));
    if (idx === -1) {
        throw base64.makeDOMException();
    }
    return idx;
}

base64.decode = function(s) {
    // convert to string
    s = '' + s;
    var getbyte64 = base64.getbyte64;
    var pads, i, b10;
    var imax = s.length
    if (imax === 0) {
        return s;
    }

    if (imax % 4 !== 0) {
        throw base64.makeDOMException();
    }

    pads = 0
    if (s.charAt(imax - 1) === base64.PADCHAR) {
        pads = 1;
        if (s.charAt(imax - 2) === base64.PADCHAR) {
            pads = 2;
        }
        // either way, we want to ignore this last block
        imax -= 4;
    }

    var x = [];
    for (i = 0; i < imax; i += 4) {
        b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12) |
            (getbyte64(s,i+2) << 6) | getbyte64(s,i+3);
        x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff, b10 & 0xff));
    }

    switch (pads) {
    case 1:
        b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12) | (getbyte64(s,i+2) << 6);
        x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff));
        break;
    case 2:
        b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12);
        x.push(String.fromCharCode(b10 >> 16));
        break;
    }
    return x.join('');
}

base64.getbyte = function(s,i) {
    var x = s.charCodeAt(i);
    if (x > 255) {
        throw base64.makeDOMException();
    }
    return x;
}

base64.encode = function(s) {
    if (arguments.length !== 1) {
        throw new SyntaxError("Not enough arguments");
    }
    var padchar = base64.PADCHAR;
    var alpha   = base64.ALPHA;
    var getbyte = base64.getbyte;

    var i, b10;
    var x = [];

    // convert to string
    s = '' + s;

    var imax = s.length - s.length % 3;

    if (s.length === 0) {
        return s;
    }
    for (i = 0; i < imax; i += 3) {
        b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8) | getbyte(s,i+2);
        x.push(alpha.charAt(b10 >> 18));
        x.push(alpha.charAt((b10 >> 12) & 0x3F));
        x.push(alpha.charAt((b10 >> 6) & 0x3f));
        x.push(alpha.charAt(b10 & 0x3f));
    }
    switch (s.length - imax) {
    case 1:
        b10 = getbyte(s,i) << 16;
        x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) +
               padchar + padchar);
        break;
    case 2:
        b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8);
        x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) +
               alpha.charAt((b10 >> 6) & 0x3f) + padchar);
        break;
    }
    return x.join('');
}

/* NOTE:
 * 0. ALWAYS SAVE XPATH VALUES AS ADDRESSES OF ORIGINAL DOM
 * 1. xpath = Offset|Relationsip|getXpath(Closest HTML Element)
 * 2. Sequence of search for associating the closest HTML element:
 * 	a. If, Check if the text node is a part of an existing highlight - ParentNode(class=highlight), pick XPATH from there.
 * 	b. Else if, Check if the previous node is a highlight - PreviousNode(class=highlight), pick XPATH from there.
 * 	c. Else if, Save the previous nodes XPATH value
 * 	d. Else if, Save the parent nodes XPATH value 
 */ 