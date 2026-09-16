; General values.
(comment) @comment
(bool_lit) @value.boolean
(null_lit) @value.null
(numeric_lit) @value.number
(expression (
  literal_value (string_lit)) @string
  (#not-has-ancestor? @string "new_index")
)

(_ "for" @keyword)
(for_intro "in" @keyword)

; Odd that this uses the inverted format to what's documented
(for_intro
  (identifier) @variable.identifier)
  
(_ [
  "if"
  "else"
  "in"
  "endif"
  "endfor" 
  ] @keyword)

; First value is the keyword.
(body 
  (block .
    (identifier) @declaration
  )
)

; Matches resources

(body 
  (block
    .
    (identifier)
    .
    (string_lit) @identifier.type
    .
    (string_lit) @definition.type
    .
    (block_start "{")
  )
)

(body 
  (block .
    (identifier)
    .
    (string_lit) @identifier.type
    .
    (block_start "{")
  )
)


; Object members

(object_elem
  key: (expression
  [
    (literal_value
      (string_lit))
    (variable_expr
      (identifier))
  ] @identifier.key
))
      
(object
  (object_elem
    val: (expression
      (variable_expr
        (identifier))
    ) @identifier.argument
))

; Block marking. Capture the first string literal as the type we're using, the
;   second as the name of instantiation we're making.
(body 
  (block
    (string_lit) @identifier.type
  ) @_blk
  (#match? @_blk "(output)")
)

; Name the various keys inside of a block.
(body (
  attribute (
    identifier) @tag.attribute.name
))

; Templated strings

((quoted_template 
  (template_interpolation) @string.template @string-template
  ) @string
)

[
  (template_interpolation_start)
  (template_interpolation_end)
] @bracket

; Various operators
(operation
  (binary_operation
    "==" @operator))
(operation
  (binary_operation
    "!=" @operator))

(binary_operation "+" @operator)
(binary_operation "-" @operator)
(binary_operation "*" @operator)
(binary_operation "%" @operator)
(binary_operation "<" @operator)
(binary_operation "<=" @operator)
(binary_operation ">" @operator)
(binary_operation ">=" @operator)

(for_object_expr "=>" @operator)

(operation
  (binary_operation
    "||" @operator))

(function_call
  (function_arguments
    "," @operator) )
    
(_ "," @operator)
(_ ":" @operator)
(expression
    (conditional
      "?" @operator))
(expression
    (conditional
      ":" @operator))
(get_attr
  "." @operator)
(ellipsis) @operator

;; Splats
(attr_splat ".*" @operator)
(_ "[*]" @operator)
(splat
  (attr_splat
    (get_attr
      (identifier) @identifier.key)))
; (splat) @operator

;;
;; Heredocs
;;
((heredoc_template
  (heredoc_start
    ["<<" "<<-"]) @operator
  (heredoc_identifier) @operator
  ) @string
)

;;
;; Heredoc templated items
;;

(template_directive
  (_
    (_
      [
        (template_directive_start)
        (strip_marker)
        (template_directive_end)
      ] @operator)
  )
)

(template_for
  (template_for_start
    (identifier) @identifier.type))
  
; Technically these are strings, and shouldn't get special treatment in the
;   template rendering here.
; (_
;   (template_literal) @_lit @value.boolean
;   (#match? @_lit "(?i)(true|false)")
; )

; Various brackets

(_ "{" @bracket)
(_ "}" @bracket)
(function_call "(" @bracket)
(function_call ")" @bracket)
(tuple_start "[" @bracket)
(tuple_end "]" @bracket)
(new_index "[" @bracket)
(new_index "]" @bracket)


;; Strings inside of function calls should be marked as arguments
;; Or inside of binary operations

((string_lit
    (template_literal)
  ) @_str
  (#has-ancestor? @_str "function_call" "binary_operation")
) @identifier.argument

;; String formatting functions should specifically be marked as something special

(
  (
    (function_call
      (function_arguments
        (expression
          (literal_value
            (string_lit
              (template_literal) @_lit @value.entity
              (#match? @_lit "%")
      ))))) @_fn
    (#contains? @_fn "format" "formatlist")
  )
) 

; Mark variables inside templates

; (expression
;   (get_attr
;     (identifier) @identifier.type.class)
;   .
;   (get_attr
;     (identifier) @identifier.key)?
; )

; Mark local, variable, module, and data names as keywords instead of types
(variable_expr
  (identifier) @keyword
  (#match? @keyword "(var|data|local|module)")
)

(variable_expr
  (identifier) @_ident
    (#not-match? @_ident "(var|data|local|module)")
    (#not-has-ancestor? @_ident "object")
) @identifier.type

; (binary_operation
;   (variable_expr (identifier) @_type)
;   (get_attr (identifier) @identifier.key)+
;   (#match? @_type "(var|local|module)")
; )

(_
  (variable_expr (identifier) @_type)
  [
    (get_attr (identifier))
    (index (new_index))
  ]+ @identifier.key
  (#match? @_type "(var|local|module)")
)

; Mark `data` correctly, as it should always be a keyword, then a type, then the definition name, and then keys.

(expression
  (variable_expr
    (identifier) @_type)
  .
  (get_attr (identifier) @identifier.type)
  .
  (get_attr (identifier) @definition.type)
  .
  [
    (get_attr (identifier))
    (index (new_index))
  ]+ @identifier.key
  (#match? @_type "(data)")
)

; Matches foo.bar.baz in an expression

(expression
  (variable_expr
    (identifier) @_type)
  .
  (get_attr (identifier) @definition.type)
  .
  (get_attr (identifier) @identifier.key)
  .
  (#not-match? @_type "(data)")
)


(expression
  (operation
    (binary_operation
      (variable_expr
        (identifier))
      .
      (get_attr
        (identifier)))))

(_
  (function_call (identifier) @function.name
))