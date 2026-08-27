execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return 1
data modify storage math:internal w set compute default math:common/rounding/double_y
execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/w_greater_than_x run return 1
data modify storage math:internal y set from storage math:internal w
function math:internal/reduce_remainder
data modify storage math:internal y set compute default math:common/rounding/half_y
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract
return 1
