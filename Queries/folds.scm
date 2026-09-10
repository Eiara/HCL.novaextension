(block
  (#set! scope.byLine)
  (#set! role block)
  ) @subtree
  
(heredoc_template
  (heredoc_start
    ["<<-" "<<"])
    (#set! role block)
) @subtree

(object
(object_start
  (#set! role block)
  "{")) @subtree
  
(function_call
  "("
) @subtree