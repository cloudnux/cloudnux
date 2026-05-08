variable "api_gateway_id" {
  description = "ID of the existing WebSocket API Gateway V2 to attach routes to."
  type        = string
}

variable "lambda_name" {
  description = "Name of the Lambda function."
  type        = string
}

variable "lambda_arn" {
  description = "ARN of the Lambda function."
  type        = string
}

variable "routes" {
  description = "Map of WebSocket route definitions keyed by entry name."
  type = map(object({
    event     = string           # connect | disconnect | message
    route_key = optional(string) # overrides the default $connect/$disconnect/$default mapping
  }))
}
