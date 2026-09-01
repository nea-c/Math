data modify storage math:internal w_asin_midpoint set compute default float math:.common/asin_positive/midpoint
data modify storage math:internal x set from storage math:internal w_asin_midpoint
function math:.common/sin/0.start
data modify storage math:internal w_asin_sine set from storage math:internal x
data modify storage math:internal w_comparison.asin_positive_before_target set compute default float math:.common/asin_positive/compare
execute if predicate math:internal/asin_positive/before_target run data modify storage math:internal w_asin_low set from storage math:internal w_asin_midpoint
execute unless predicate math:internal/asin_positive/before_target run data modify storage math:internal w_asin_high set from storage math:internal w_asin_midpoint
return 1
