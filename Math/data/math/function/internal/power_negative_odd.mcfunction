function math:internal/log_x
data modify storage math:internal x set compute default math:power/positive/00
execute unless predicate math:internal/exp/input_finite run return run function math:internal/power_nonfinite_negative
execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value -0.0f
execute if predicate math:internal/exp/underflows_to_zero run return 1
execute if predicate math:internal/exp/minimum_nonzero run data modify storage math: ans set compute default math:exp/minimum/negative/00
execute if predicate math:internal/exp/minimum_nonzero run return 1
execute if predicate math:internal/power/needs_overflow_classification run return run function math:internal/power_boundary_negative
execute unless predicate math:internal/exp/input_in_range run data remove storage math: ans
execute unless predicate math:internal/exp/input_in_range run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/input_in_range run return fail
function math:internal/exp_x
data modify storage math: ans set compute default math:common/rounding/negate
execute unless predicate math:internal/exp/result_finite run data remove storage math: ans
execute unless predicate math:internal/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/result_finite run return fail
return 1
