; Top-level resource block handling
((block
    ; identifier will be 'data' or 'resource' or something
    (identifier) @name
    .
    ; type of resource
    (string_lit
      (template_literal) @name) @start.before
    ; name of resource
    (string_lit
      (template_literal) @name
      ; marks the end of the quote mark so that the whole line is selected for the symbol
      (quoted_template_end) @end.after
      )
    (#set! role class)
  ) @displayname.target
  (#set! displayname.query "terraform/displayQuery.scm")
) @subtree

; inner blocks
(body
  (block
    (identifier) @name
  ) @_block @subtree
  (#has-ancestor? @_block "block")
  (#set! role class)
)

;; Output-style resources

(
  ((block
    (identifier) @name @_ident @start.before
    (string_lit
      (template_literal) @name
      (quoted_template_end) @end.after)
    )
  ) 
  (#match? @_ident "(output)")
  (#set! role class)
  (#replace! @name "\\s+" ".")
) @subtree