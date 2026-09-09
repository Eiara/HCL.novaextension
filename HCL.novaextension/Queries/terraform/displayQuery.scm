(block
  (identifier) @result @_ident
  (#match? @_ident "(data)" )
  (#append! @result ".")
)

(
  (block
    (identifier)
    (string_lit
      (template_literal) @result)+
  )
  (#replace! @result "\\s+" ".")
)

; (block
;   ; identifier will be 'data' or 'resource' or something
;   (identifier)
;   .
;   ; type of resource
;   (string_lit
;     (template_literal) @name) @start.before
;   ; name of resource
;   (string_lit
;     (template_literal) @name @displayname.target
;     (quoted_template_end) @end.after) 
;   (#set! role class)
;   (#set! displayname.query "terraform/displayQuery.scm")
; ) @subtree