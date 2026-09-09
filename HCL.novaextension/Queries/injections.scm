(heredoc_template
  (heredoc_identifier) @_ident
  (template_literal) @injection.content
  (#match? @_ident "(?i)(YAML)")
  (#set! injection.language yaml)
)

(heredoc_template
  (heredoc_identifier) @_ident
  (template_literal) @injection.content
  (#match? @_ident "(?i)(JSON)")
  (#set! injection.language JSON)
)

(heredoc_template
  (heredoc_identifier) @_ident
  (template_literal) @injection.content
  (#match? @_ident "(?i)(TOML)")
  (#set! injection.language TOML)
)

(heredoc_template
  (heredoc_identifier) @_ident
  (template_literal) @injection.content
  (#match? @_ident "(?i)(MARKDOWN|MD|MDOWN)")
  (#set! injection.language Markdown)
)

(heredoc_template
  (heredoc_identifier) @_ident
  (template_literal) @injection.content
  (#match? @_ident "(?i)(SHELL|BASH|SHELLCOMMANDS)")
  (#set! injection.language shell)
)

;; TODO
;; Add other injection formats as required