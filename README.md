## Unofficial HCL syntax extension for Panic Nova

Language extension using the unofficial [HCL tree sitter grammar](https://github.com/tree-sitter-grammars/tree-sitter-hcl).

Includes support for:
 - terraform,
 - packer,
 - generic HCL.

Formatting for Terraform files is provided using the existing Terraform binary, and format-on-save can be enabled in extension or project preferences.

## Language Server

Provides initial integration with the [Hashicorp Terraform Language Server](https://github.com/hashicorp/terraform-ls), disabled by default. The language server can be enabled for testing in either extension or project settings.

This extension is NOT maintained by Hashicorp.

Extension icon by CC-BY-SA-4.0 Sethvargo, retreived from [Wikipedia](https://en.wikipedia.org/wiki/HashiCorp#/media/File:HashiCorp_Logo_no_text.png)