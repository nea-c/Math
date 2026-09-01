data modify storage math:internal w_bezier_midpoint set compute default float math:bezier/midpoint
data modify storage math:internal w_bezier_y set compute default float math:bezier/y
data modify storage math: ans set compute default float math:bezier/result
data modify storage math:internal w_validation_ans set compute default float math:internal/comparison/finite/ans
execute unless data storage math:internal {w_validation_ans:0.0f} run return run function math:.common/_error/result_out_of_range
return 1
