data modify storage math:internal w_comparison.predicate.rounding_remainder_y_too_large_to_double set compute default float math:internal/comparison/predicate/rounding/remainder/y_too_large_to_double/value
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default float math:.common/sub
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return run function math:.common/reduce_remainder/4.finish_one
data modify storage math:internal w set compute default float math:.common/rounding/double_y
data modify storage math:internal w_comparison.predicate.rounding_remainder_w_greater_than_x set compute default float math:internal/comparison/predicate/rounding/remainder/w_greater_than_x/value
execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default float math:.common/sub
execute if predicate math:internal/rounding/remainder/w_greater_than_x run return run function math:.common/reduce_remainder/4.finish_one
data modify storage math:internal y set from storage math:internal w
return run function math:.common/reduce_remainder/3.shallow_two
