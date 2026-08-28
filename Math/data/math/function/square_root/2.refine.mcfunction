data modify storage math:internal w_comparison.sqrt_estimate_at_least_two set compute default math:square_root/reciprocal/compare_at_least_two
data modify storage math:internal x set compute default math:square_root/reciprocal/input
data modify storage math:internal y set compute default math:square_root/reciprocal/numerator
function math:.common/reciprocal/4.finish
data modify storage math:internal w_sqrt_reciprocal set from storage math:internal x
data modify storage math:internal w_sqrt_estimate set compute default math:square_root/newton/update
return 1
