variable "entrypoints" {
  type = map(object({
    description        = string
    method             = string
    path               = string
    timeout            = optional(number, 29000)
    authorization_type = optional(string, "NONE")
    authorizer_id      = optional(string)
  }))
}

variable "lambda_name" {
  type = string
}

variable "lambda_arn" {
  type = string
}

variable "api_gateway_id" {
  type = string
}
