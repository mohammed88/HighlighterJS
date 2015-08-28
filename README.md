# HighlighterJS API's:

**`$h.create( Document context, String id )`**

Parameters: 
1. context: Document object on which the highlight needs to be applied.
2. id: String to uniquely identify the highlight.

Returns an object literal with the following properties:

1. key: String used to re-apply the highlight. Check apply() API.
2. merged: Boolean indicating whether the highlight had merged with other highlights.
3. mergedItems: Array of id's of merged highlights.


**`$h.apply( String key, Document context, String id )`**

Parameters: 
1. key: String returned from $h.create API.
2. context: Document object on which the highlight needs to be applied.
3. id: String to uniquely identify the highlight.

Returns an object literal with the following properties:

1. success: Boolean to indicated if the highlight was applied successfully.
2. merged: Boolean indicating whether the highlight had merged with other highlights.
3. mergedItems: Array of id's of merged highlights.

#Use cases:

```
<h-l> is the custom tag added to depict an existing highlight

RELATIVE HIGHLIGHTS
-------------------

=>Closest original node: PreviousSibling

<p>
	text <b>text</b> text <h-l>text</h-l> te{{x}}t
</p>

=>Closest orginal node: ParentNode

<p>
	text <h-l>text</h-l> te{{x}}t
</p>

MERGE HIGHLIGHTS
----------------
=>After:

<p>
	text <h-l>te{{xt</h-l> text}}
</p>

=>Before:

<p>
	te{{xt <h-l>te}}xt</h-l> text
</p>

=>Join:

<p>
	text <h-l>te{{xt</h-l> text <h-l>te}}xt</h-l>
</p>

=>Combine:

<p>
	{{text <h-l>text</h-l> text <h-l>text</h-l> text}}
</p>

=>Within:

<p>
	text <h-l>t{{ex}}t</h-l> text
</p>
```