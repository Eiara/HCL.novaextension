## 0.1.16

- Improve Packer rendering
- Fix indentation on Packer

## 0.1.15

- Support HEREDOCs in `locals` declaration blocks

## 0.1.14

- Support `_name` names for locals and variables
- Terraform `provider` blocks now support dotted references
- `map` and `list` variable Clips now use correct syntax of `map(type)`
- `if` statements can now correctly include strings

## 0.1.13

- Support single-character resource names

## 0.1.12

- Improve YAML sublanguage parsing support in HEREDOC statements
- Adds variable dotted types to Packer HCL
- Adds dotted types to resource definitions

## 0.1.11

- Add function rendering to maps

## 0.1.10

- Add syntactic elements to `if` statements
- Add syntactic elements to `for-in` statements
- JSON HEREDOCs to use the JSON parser
- Add `values` parsing to maps
- Rename interpolations to `string-template`, for better - highlighting support
- Rename functions to `built-in`, for better highlighting support
- Add numbers, values, and comments to function calls
- Use `type` instead of `argument` for Terraform
-   provider blocks
- Use `definition.type` instead of `block` for Terraform
-   output blocks
- Improve handling of output block names
- Use `definition.type` for Terraform resource blocks
- Use `type.name` for resource block names
- Initial `for-in` completion

## 0.1.9

- Improves rendering of ternary operators

## 0.1.8

- Add `-` to map key names

## 0.1.7

- Adds functions and numbers to array parsing

## 0.1.6

- Improve cutoffs and handling for variables and dotted references

## 0.1.5

- Fix an issue with `locals`

## 0.1.4

- Add pkrvars support
- README updates

## 0.1.3

- Rename "Vendor" to "Organisation" in extension.json
- Add "type" support to data and resource objects
- Add packer to language activation events

## 0.1.2

- Improves handling of blocks, maps, and inner blocks

## 0.1.1

- Support any HEREDOC tags
- Add initial syntax support for variables, locals, terraform blocks
- Add formatter support, configuration for formatting
- On-the-fly bin path updates
- Add initial support for code symbols
- Cleanup for Nova 4
- Add initial clips


## 0.1.0

Initial release
Adds:
 - Blocks
 - Inner blocks
 - Variables
 - HEREDOCs
 - assignments
 - Some keywords
 - Functions
