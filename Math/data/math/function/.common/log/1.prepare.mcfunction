function math:.common/normalize_binary32/0.start
data modify storage math:internal w_comparison.log_center set compute default math:log/normalize/compare_center/00
data modify storage math:internal z set compute default math:log/normalize/centered_mantissa/00
data modify storage math:internal w set compute default math:log/normalize/centered_exponent/00
return 1
