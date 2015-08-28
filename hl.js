/**
	Make and re-apply highlights on the browser with ease & confidence.
	@author - Mohammed.
 */

/** Base64 encoder-decoder */
var k={a:"=",ALPHA:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",b:function(){try{return new DOMException}catch(a){var b=Error("DOM Exception 5");b.code=b.h=5;b.name=b.description="INVALID_CHARACTER_ERR";b.toString=function(){return"Error: "+b.name+": "+b.message};return b}},f:function(a,b){var c=k.ALPHA.indexOf(a.charAt(b));if(-1===c)throw k.b();return c},decode:function(a){a=""+a;var b=k.f,c,d,e,f=a.length;if(0===f)return a;if(0!==f%4)throw k.b();c=0;a.charAt(f-1)===k.a&&(c=
1,a.charAt(f-2)===k.a&&(c=2),f-=4);var h=[];for(d=0;d<f;d+=4)e=b(a,d)<<18|b(a,d+1)<<12|b(a,d+2)<<6|b(a,d+3),h.push(String.fromCharCode(e>>16,e>>8&255,e&255));switch(c){case 1:e=b(a,d)<<18|b(a,d+1)<<12|b(a,d+2)<<6;h.push(String.fromCharCode(e>>16,e>>8&255));break;case 2:e=b(a,d)<<18|b(a,d+1)<<12,h.push(String.fromCharCode(e>>16))}return h.join("")},c:function(a,b){var c=a.charCodeAt(b);if(255<c)throw k.b();return c},encode:function(a){if(1!==arguments.length)throw new SyntaxError("Not enough arguments");
var b=k.a,c=k.ALPHA,d=k.c,e,f,h=[];a=""+a;var l=a.length-a.length%3;if(0===a.length)return a;for(e=0;e<l;e+=3)f=d(a,e)<<16|d(a,e+1)<<8|d(a,e+2),h.push(c.charAt(f>>18)),h.push(c.charAt(f>>12&63)),h.push(c.charAt(f>>6&63)),h.push(c.charAt(f&63));switch(a.length-l){case 1:f=d(a,e)<<16;h.push(c.charAt(f>>18)+c.charAt(f>>12&63)+b+b);break;case 2:f=d(a,e)<<16|d(a,e+1)<<8,h.push(c.charAt(f>>18)+c.charAt(f>>12&63)+c.charAt(f>>6&63)+b)}return h.join("")}};window.base64=k;

"use strict";

(function( global ) {
	var debug = true;

	/** Make highlight module. */
	function Highlight() {}

	// @TODO: Should region -> range for apply? To use isMerge() under decodeRange()
	Highlight.prototype.create = function( val, context, id ) {
		var region, merged = [];

		region = typeof val === "string" ? decodeKey( val, context ) : decodeRange( val );
		merged = paint( region, id );

		return {
			key: encodeKey( region ),
			merged: merged.length ? true : false,
			mergedItems: merged
		};
	};

	Highlight.prototype.remove = function ( element, id ) {
		if ( element ) {
			if ( element.nodeType == 1 ) {
				if ( element.nodeName.toLowerCase() === "h-l" && element.getAttribute( "ref" ).indexOf( id ) !== -1) {
					var text = element.removeChild( element.firstChild );
					element.parentNode.insertBefore( text,element );
					element.parentNode.removeChild( element );
					return true;
				} else {
					var normalize = false;
					for ( var i = element.childNodes.length - 1; i >= 0; i-- ) {
						if ( this.remove( element.childNodes[i], id ) ) normalize = true;
					}
					if (normalize) navigator.userAgent.indexOf( "rv:11" ) === -1 ? element.normalize() : normalize( element );
				}
			}
		}
		return false;
	};


	/**	Helper functions. */

	/**
	 * Custom implementation of normalize method
	 * @param DOMElement - having broken child text nodes. 
	 */

	function normalize( element ) {
		var children = element.childNodes,
				found = false, 
				i = 0;

		while( i < children.length ) {
			if( children[i].nodeType === 3 ) {
				if( found ) {
					 children[i - 1].nodeValue =  children[i - 1].nodeValue + children[i].nodeValue;
					 children[i].parentNode.removeChild( children[i] );
				} else {
					found = true;
					i++;
				}
			} else {
				found = false;
				i++;
			}
		}
	}

	function encodeKey( region ) {
		// convert the DOM reference to XPath values before stringify()
		region.start.reference = getXPath( region.start.reference );
		region.end.reference = getXPath( region.end.reference );
		return base64.encode( region.stringify() );
	}

	function decodeKey( key, context ) {
		var region = eval( "(" + base64.decode( key ) + ")" );
		region.start.reference = getElementFromXPath( region.start.reference, context );
		region.end.reference = getElementFromXPath( region.end.reference, context );
		return new Region(region.start, region.end);
	}

	/**
		Converts Range -> Region { start: new Location(), end: new Location() }
	 */

	function decodeRange( range ) {
		log( range );
		range = isMerged( range );

		return new Region(
								getLocation( range.startContainer, range.startOffset ),
								getLocation( range.endContainer  , range.endOffset )
							 );
	}

	/**
		Checks and updates range object if highlights are merged.
		@param range object { startContainer: , endContainer: , startOffset: , endOffset: }
		@return range object (updated due to merge)
	 */

	function isMerged( range ) {

		var items = [],
			startContainer = range.startContainer,
			endContainer = range.endContainer,
			startOffset = range.startOffset,
			endOffet = range.endOffset;

		if( startContainer.parentNode.nodeType === 1 && startContainer.parentNode.nodeName.toLowerCase() === "h-l" ) {
			startContainer = document.querySelector( "[ref='" + startContainer.parentNode.getAttribute( "ref" ) + "']" ); // update reference to the first <h-l> for this highlight
			startOffset = 0;
		}

		if( endContainer.parentNode.nodeType === 1 && endContainer.parentNode.nodeName.toLowerCase() === "h-l" ) {
			endContainer = document.querySelector( "[ref='" + endContainer.parentNode.getAttribute( "ref" ) + "']:last-child" ); // update reference to the last <h-l> for this highlight
			endOffet = endContainer.innerHTML.length;
		}

		return {
			startContainer: startContainer,
			endContainer: endContainer,
			startOffset: startOffset,
			endOffset : endOffet
		};
	}

	/**
		Applies highlight to the selected area
		@return Array merged list of all merged <h-l> (ref value)
	 */

	function paint( region, id ) {

		var start = parseLocation( region.start );
		var end   = parseLocation( region.end );

		var result = getTextNodes( start.node, end.node ),
			nodes = result.nodes;
		
		if ( nodes.length === 1 ) {
			paintTextNode( nodes[0], start.offset, end.offset, id );
		} else {
			for( var i = 0, l = nodes.length; i < l; i++ ) {
				if ( i === 0 ) {
					paintTextNode( nodes[i], start.offset, nodes[i].nodeValue.length, id );
				}
				else if ( i === l - 1 ) {
					paintTextNode( nodes[i], 0, end.offset, id );
				}
				else {
					paintTextNode( nodes[i], 0, nodes[i].nodeValue.length, id );
				}
			}
		}
		return result.merged;
	}

	/**
		-> Paint the text nodes that needs highlight by wrapping them inside <h-l>
		-> Dont paint text nodes already inside <h-l>, just update the ids
	 */

	function paintTextNode( node, startOffset, endOffset, id ) {
		// update id incase node is painted
		if( node.parentNode.nodeName.toLowerCase() === "h-l" ) {
			node.parentNode.setAttribute("ref", id);
			return;
		}

		var parent = node.parentNode,
			hlElement = document.createElement( "h-l" ),
			nodeValue = node.nodeValue,
			text1 = nodeValue.substr( 0, startOffset ),
			text2 = nodeValue.substr( startOffset, endOffset - startOffset ),
			text3 = nodeValue.substr( endOffset );

		hlElement.setAttribute( "ref", id );
		hlElement.appendChild( document.createTextNode( text2 ) );
		parent.insertBefore( hlElement, node );
		parent.removeChild( node );

		if( text1.length > 0 ) {
			parent.insertBefore( document.createTextNode(text1), hlElement );
		}

		if ( text3.length > 0 ) {
			hlElement.nextSibling ? parent.insertBefore( document.createTextNode( text3 ), hlElement.nextSibling )
														: parent.appendChild( document.createTextNode( text3 ) );
		}
	}

	/**
		Return text nodes contained between the start and end nodes.Avoid empty text nodes
	 */

	function getTextNodes( start, end ) {
		var nodes = [], merged = [], regex = /[ \t\n\r]/g;
		for( var node = start; node; node = getNextNode(node) ) {
			if( node.nodeType === 3 && node.nodeValue.replace(regex, "").length > 0 ) nodes.push( node );
			if( node.nodeType === 1 && node.nodeName.toLowerCase() === "h-l" ) merged.pushUnique( node.getAttribute( "ref" ) );
			if(node === end) return { nodes: nodes, merged: merged };
		}
	}

	Array.prototype.pushUnique = function( val ) {
		if( this.indexOf( val ) === -1 ) this.push( val );
	}

	function getNextNode(node) {
		if ( node.firstChild )
			return node.firstChild;

		while ( node ) {
			if (node.nextSibling) return node.nextSibling;
			node = node.parentNode;
		}
	}

	function getXPath( element ) {

		//calculate the index of occurance of the "element" w.r.t the parentNode
		for ( var xpath = "", prevSib, id; element && element.nodeType == 1; element = element.parentNode ) {
			prevSib = element.previousSibling;
			id = 1;
			
			while( prevSib != null ) { // is null when it runs out of previous nodes
				if( prevSib.nodeType === 1 ) { // omit text nodes
					if( prevSib.tagName.toLowerCase() === element.tagName.toLowerCase() ) {
						id++;
					}
				}
				prevSib = prevSib.previousSibling;
			}
			id > 1 ? (id = '[' + id + ']') : (id = '');
			xpath = '/' + element.tagName.toLowerCase() + id + xpath;
		}
		return xpath;
	}

	function getElementFromXPath( xpath, doc ) {
		var element,
			nodes = doc.body.childNodes,
			xpathNodes = xpath.split("/").splice(3); //remove the "", "html" and "body"

		Array.prototype.slice.call( nodes ).unshift( doc.body ); //NodeList -> Array
		
		var i = 0, miss = 0, node, index, temp;
		while( i < xpathNodes.length && miss < 2 ) {
			if( xpathNodes[i].indexOf("[") !== -1 ) { //index exists
				temp = xpathNodes[i].split("[");
				node = temp[0];
				temp = temp[1].split("]");
				index = parseInt(temp[0]);
			}
			else{
				node = xpathNodes[i];
				index = 1;
			}

			for( var j = 0, l = nodes.length; j < l; j++ ) { //check for the xpathNode in the nodes
				if( nodes[j].nodeName.toUpperCase() === node.toUpperCase() ){
					--index;
					if( index === 0 ){
						element = nodes[j];
						nodes = element.childNodes; // update the value of nodes to look further inside the dom
						i++;
						break;
					}
				}
			}
			// to handle mismatch in xpath sequence. eg: missing tbody
			if( j === l ) {
				if( node.toLowerCase() === "tr" ){
					for( var j_m = 0, len_m = nodes.length; j_m < len_m; j_m++ ) { //check for the xpathNode in the nodes
						if( nodes[j_m].nodeName.toLowerCase() === "tbody" ) {
							element = nodes[j_m];
							nodes = element.childNodes; // updatind the value of nodes to look further inside the dom
							break;
						}
					}
				} 
				else if( node.toLowerCase() === "tbody" ){
					i++; // skip and look for the next <tr>
				}
				else {
					miss++;
				}
			}
		}
		return element;
	}

	/**
		Get data for the Location object. Returns { reference: node, relation: <none/parent/prev-sib>, offset: <number> }
		@param {object} node - DOM node
		@param {number} offset - offset value
	 */

	function getLocation( node, offset ) {
		var reference, relation, originalDomRefs;

		if( node.nodeType === 1 ) {
			if( node.nodeName.toLowerCase() === "h-l" ) {
				originalDomRefs = getOriginalDomRefs( node, "none", offset );
				reference = originalDomRefs.reference;
				relation = originalDomRefs.relation;
				offset = originalDomRefs.offset;
			} else {
				reference = node;
				relation = "none";
			}
		} else {
			if( node.previousSibling && node.previousSibling.nodeType === 1 ) {
				if(node.previousSibling.nodeName.toLowerCase() === "h-l") { // relative highlights
					originalDomRefs = getOriginalDomRefs( node.previousSibling, "prev-sib", offset );
					reference = originalDomRefs.reference;
					relation = originalDomRefs.relation;
					offset = originalDomRefs.offset;
				} else {
					reference = node.previousSibling;
					relation = "prev-sib";
				}
			} else {
				if(node.parentNode.nodeName.toLowerCase() === "h-l") { // merge highlights
					originalDomRefs = getOriginalDomRefs( node.parentNode, "parent", offset );
					reference = originalDomRefs.reference;
					relation = originalDomRefs.relation;
					offset = originalDomRefs.offset;
				} else {
					reference = node.parentNode;
					relation = "parent";
				}
			}
		}

		return new Location( reference, relation, offset );
	}

	/**
		Return original DOM references which are polluted by <h-l> tags
	 */

	function getOriginalDomRefs( reference, relation, offset ) {
		var refNodeFound = false,
			prevSib;

		if( relation === "prev-sib" ) {
			offset += reference.innerHTML.length;
		}
		else if( relation === "parent" || relation === "none" ) {
			relation = "prev-sib";
		}

		prevSib = reference.previousSibling;
		while( prevSib ) { // look for prev sibling != <h-l> and calc offset for it
			if( prevSib.nodeType === 1 ) {
				if( prevSib.nodeName.toLowerCase() !== "h-l" ) {
					reference = prevSib;
					refNodeFound = true;
					break;
				} else {
					offset += prevSib.innerHTML.length;
				}
			}
			else { // text-node
				offset += prevSib.nodeValue.length;
			}
			prevSib = prevSib.previousSibling;
		}

		if( !refNodeFound ) { // fallback on parent node and calc offset for it
			reference =  reference.parentNode;
			relation = "parent";
		}		

		return new Location( reference, relation, offset );
	}

	/**
		Returns the actual node and offset value from the Location object - {val: , offset: }
		Inverses the effects of "getLocation", Location -> {node, offset}
	 */

	function parseLocation( location ) {
		var node,
			reference = location.reference,
			relation = location.relation,
			offset = location.offset;

		if( relation === "none" ) {
			node = reference;
		}
		else if( relation === "prev-sib" ) {
			if( reference.nextSibling.nodeType === 3 && reference.nextSibling.nodeValue.length > offset ) {
				node = reference.nextSibling;
			} else {
				var temp = getRelativeDomRefs( reference, relation, offset );
				node = temp.node;
				offset = temp.offset;
			}			
		}
		else {
			if( reference.nextSibling.nodeType === 3 && reference.nextSibling.nodeValue.length > offset ) {
				node = reference.firstChild;
			} else {
				var temp = getRelativeDomRefs( reference, relation, offset );
				node = temp.node;
				offset = temp.offset;
			}				
		}

		return { node: node, offset: offset };
	}

	function getRelativeDomRefs( reference, relation, offset ) {
		var refNodeFound = false,
			nextSib,
			nodeLen;

		// get reference path to the required text node
		if( relation === "prev-sib" ) {
			nextSib = reference.nextSibling;
		} 
		else if( relation === "parent" ) {
			nextSib = reference.firstChild;
		}

		// calculate new offset
		while( true ) {
			if( nextSib.nodeType === 3 ) {
				nodeLen = nextSib.nodeValue.length;
			} else {
				if( nextSib.nodeName.toLowerCase() !== "h-l" ) log( "Check line 367!!" );
				nodeLen = nextSib.innerHTML.length;
			}

			offset -= nodeLen;

			if( offset < 0 ) {
				reference = nextSib;
				offset += nodeLen;
				break;
			}	
			nextSib = nextSib.nextSibling;
		}

		return { node: reference, offset: offset };

	}

	function log( msg ) {
		if(debug) console.log(msg);
	}

	// Data structure constructors

	/**
		Represents a Location
		@constructor
		@param {object} data - { reference: , relation: , offset: }
	 */
	
	function Location( reference, relation, offset ) {
		this.reference = reference;
		this.relation = relation;
		this.offset = offset;
	}

	function Region( start, end ) {
		this.start = start;
		this.end = end;
	}

	Region.prototype.stringify = function() {

		return "{" + 
							"\"start\":" + stringifyLocation( this.start ) + "," +
							"\"end\"  :" + stringifyLocation( this.end ) +
					 "}";

		function stringifyLocation( location ) {
			return "{" +
								"\"reference\":\"" + location.reference + "\"," +
								"\"relation\":\""  + location.relation + "\"," +
								"\"offset\":" + location.offset +
						 "}";
		}
	};

	//Expose create(), apply() and remove()APIs to the global scope

	global.$h = (function() {
		//Initialize Highlight module
		var highlight = new Highlight();

		return {
			create: function( context, id ) {
				log( "Make" );
				//try {
					var range = context.getSelection().getRangeAt(0);
					return highlight.create( range, context, id );
				//} catch(e) { log("ERR: " + e.message); }
			},

			apply: function( key, context, id ) {
				log( "Apply" );
				return highlight.create( key, context, id );
			},

			remove: function( context, id ) {
				log("Remove");
				return highlight.remove( context.body, id );
			}
		};
	})();
})( typeof window !== "undefined" ? window : this );

/**
	region = {
		start: new Location(reference, relation, offset),
		end: new Location(reference, relation, offset)
	}
	Note: region saves original DOM refsusing getLocation
 */

